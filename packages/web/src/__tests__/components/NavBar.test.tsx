import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { NavBar } from "../../components/NavBar";

describe("NavBar", () => {
  function renderNavBar(initialPath = "/equipes") {
    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <NavBar />
      </MemoryRouter>
    );
  }

  it("renders the brand name", () => {
    renderNavBar();
    expect(screen.getByText("USFTT Resultats")).toBeInTheDocument();
  });

  it("renders 3 navigation links", () => {
    renderNavBar();
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("renders the Equipes link", () => {
    renderNavBar();
    expect(screen.getByRole("link", { name: "Equipes" })).toBeInTheDocument();
  });

  it("renders the Criterium link", () => {
    renderNavBar();
    expect(screen.getByRole("link", { name: "Criterium" })).toBeInTheDocument();
  });

  it("renders the Progression link", () => {
    renderNavBar();
    expect(screen.getByRole("link", { name: "Progression" })).toBeInTheDocument();
  });
});
