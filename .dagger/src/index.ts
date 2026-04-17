/**
 * USFTT Results CI/CD pipeline
 *
 * Replaces GitHub Actions YAML with type-safe, locally-runnable pipeline functions.
 * Run `dagger call ci --source=.` to execute the full CI pipeline locally.
 */
import { dag, Container, Directory, Secret, object, func } from "@dagger.io/dagger"

@object()
export class UsfttCi {
  /**
   * Run the full CI pipeline: install, typecheck, lint, test, drizzle check, build
   */
  @func()
  async ci(source: Directory): Promise<string> {
    const base = this.install(source)

    // Run checks in parallel by requesting all outputs together
    const [typecheckOut, lintOut, testOut, drizzleOut] = await Promise.all([
      base.withExec(["npx", "turbo", "run", "typecheck"]).stdout(),
      base.withExec(["npm", "run", "lint"]).stdout(),
      base.withExec(["npm", "run", "test"]).stdout(),
      base
        .withWorkdir("/src/packages/api")
        .withExec(["npx", "drizzle-kit", "check"])
        .stdout(),
    ])

    // Build to ensure it compiles
    await base.withExec(["npm", "run", "build"]).stdout()

    return "CI passed"
  }

  /**
   * Build Docker images for API and Web from the existing Dockerfile
   */
  @func()
  async buildImages(
    source: Directory,
    viteApiUrl: string = "https://api.usftt-results.bercail.cloud",
  ): Promise<string> {
    // Build API image
    await source.dockerBuild({ target: "api" }).sync()

    // Build Web image with build arg
    await source
      .dockerBuild({
        target: "web",
        buildArgs: [{ name: "VITE_API_URL", value: viteApiUrl }],
      })
      .sync()

    return "Images built successfully"
  }

  /**
   * Build and push Docker images to GHCR
   */
  @func()
  async publish(
    source: Directory,
    githubToken: Secret,
    gitSha: string,
    viteApiUrl: string = "https://api.usftt-results.bercail.cloud",
  ): Promise<string> {
    const registry = "ghcr.io"
    const username = "dcuenot"

    // Build API image from Dockerfile
    const apiImage = source
      .dockerBuild({ target: "api" })
      .withRegistryAuth(registry, username, githubToken)

    // Build Web image from Dockerfile
    const webImage = source
      .dockerBuild({
        target: "web",
        buildArgs: [{ name: "VITE_API_URL", value: viteApiUrl }],
      })
      .withRegistryAuth(registry, username, githubToken)

    // Push both in parallel
    const [apiRef, webRef] = await Promise.all([
      apiImage.publish(`${registry}/${username}/usftt-results-api:latest`),
      apiImage.publish(`${registry}/${username}/usftt-results-api:${gitSha}`),
      webImage.publish(`${registry}/${username}/usftt-results-web:latest`),
      webImage.publish(`${registry}/${username}/usftt-results-web:${gitSha}`),
    ])

    return `Published api and web images for ${gitSha}`
  }

  /**
   * Deploy to VPS via SSH: copy docker-compose, pull images, restart
   */
  @func()
  async deploy(
    source: Directory,
    sshKey: Secret,
    vpsHost: string,
    vpsUser: string = "deploy",
  ): Promise<string> {
    const deployDir = "/opt/usftt-results"

    const deployer = dag
      .container()
      .from("alpine:latest")
      .withExec(["apk", "add", "--no-cache", "openssh-client", "docker-cli", "docker-cli-compose"])
      .withExec(["mkdir", "-p", "/root/.ssh"])
      .withMountedSecret("/tmp/ssh-key", sshKey)
      .withExec(["sh", "-c", "cp /tmp/ssh-key /root/.ssh/id_ed25519 && chmod 600 /root/.ssh/id_ed25519"])
      .withExec([
        "sh", "-c",
        `ssh-keyscan -H ${vpsHost} >> /root/.ssh/known_hosts 2>/dev/null`,
      ])
      .withFile("/tmp/docker-compose.yml", source.file("docker-compose.yml"))

    // Copy docker-compose.yml and deploy
    await deployer
      .withExec([
        "scp", "-o", "StrictHostKeyChecking=accept-new",
        "/tmp/docker-compose.yml",
        `${vpsUser}@${vpsHost}:${deployDir}/docker-compose.yml`,
      ])
      .withExec([
        "ssh", "-o", "StrictHostKeyChecking=accept-new",
        `${vpsUser}@${vpsHost}`,
        `cd ${deployDir} && docker compose pull && docker compose up -d --wait --wait-timeout 60 && docker image prune -f`,
      ])
      .stdout()

    return `Deployed to ${vpsHost}`
  }

  /**
   * Create a Node.js container with dependencies installed
   */
  private install(source: Directory): Container {
    const npmCache = dag.cacheVolume("npm-cache")

    return dag
      .container()
      .from("node:22-alpine")
      .withMountedCache("/root/.npm", npmCache)
      .withDirectory("/src", source)
      .withWorkdir("/src")
      .withExec(["npm", "ci"])
      .withExec(["npm", "run", "build", "-w", "@usftt/shared"])
  }
}
