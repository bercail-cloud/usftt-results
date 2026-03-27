import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NavBar } from "../../components/NavBar";

describe("NavBar", () => {
  function renderNavBar(initialPath = "/equipes") {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialPath]}>
          <NavBar />
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  it("renders the brand name", () => {
    renderNavBar();
    expect(screen.getByText("USFTT Résultats")).toBeInTheDocument();
  });

  it("renders navigation links", () => {
    renderNavBar();
    // 3 main + 1 sync (desktop only) + 3 mobile bottom tab bar = 7
    expect(screen.getAllByRole("link")).toHaveLength(7);
  });

  it("renders the Equipes link", () => {
    renderNavBar();
    expect(screen.getAllByRole("link", { name: /quipes/i }).length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Criterium link", () => {
    renderNavBar();
    expect(screen.getAllByRole("link", { name: /rit.rium/i }).length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Progression link", () => {
    renderNavBar();
    expect(screen.getAllByRole("link", { name: /progression/i }).length).toBeGreaterThanOrEqual(1);
  });
});
