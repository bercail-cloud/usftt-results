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

  it("renders 3 navigation links", () => {
    renderNavBar();
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("renders the Equipes link", () => {
    renderNavBar();
    expect(screen.getByRole("link", { name: "Équipes" })).toBeInTheDocument();
  });

  it("renders the Criterium link", () => {
    renderNavBar();
    expect(screen.getByRole("link", { name: "Critérium" })).toBeInTheDocument();
  });

  it("renders the Progression link", () => {
    renderNavBar();
    expect(screen.getByRole("link", { name: "Progression" })).toBeInTheDocument();
  });
});
