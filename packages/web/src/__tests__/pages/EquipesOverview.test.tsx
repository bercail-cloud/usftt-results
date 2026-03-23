import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { EquipesOverview } from "../../pages/EquipesOverview.js";

vi.mock("../../hooks/use-equipes.js", () => ({
  useEquipes: vi.fn(),
  useEquipeDetail: vi.fn(),
  useRencontreDetail: vi.fn(),
}));

import { useEquipes } from "../../hooks/use-equipes.js";

const mockUseEquipes = useEquipes as ReturnType<typeof vi.fn>;

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderPage() {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={["/equipes"]}>
        <EquipesOverview />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("EquipesOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the page title", () => {
    mockUseEquipes.mockReturnValue({
      data: { groups: [], lastSync: null },
      isLoading: false,
      isError: false,
    });
    renderPage();
    expect(screen.getByText("Résultats par équipes")).toBeInTheDocument();
  });

  it("shows loading skeleton when loading", () => {
    mockUseEquipes.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });
    renderPage();
    const skeleton = document.querySelector(".animate-pulse");
    expect(skeleton).toBeInTheDocument();
  });

  it("shows empty state when no data", () => {
    mockUseEquipes.mockReturnValue({
      data: { groups: [], lastSync: null },
      isLoading: false,
      isError: false,
    });
    renderPage();
    expect(screen.getByText("Aucune équipe trouvée")).toBeInTheDocument();
  });

  it("shows error state when request fails", () => {
    mockUseEquipes.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("Network error"),
    });
    renderPage();
    expect(screen.getByText(/Erreur/)).toBeInTheDocument();
  });

  it("renders phase and level groups when data is available", () => {
    mockUseEquipes.mockReturnValue({
      data: {
        groups: [
          {
            level: "Departementale",
            equipes: [
              {
                equipe: {
                  id: 1,
                  lib_equipe: "USFTT 1",
                  lib_division: "D1 Masculine Phase 2 Poule 1",
                  type_epreuve: "M",
                },
                classements: [{ position: 1, points: 10 }],
                rencontres: [],
              },
            ],
          },
        ],
        lastSync: null,
      },
      isLoading: false,
      isError: false,
    });
    renderPage();
    expect(screen.getByText("Phase 2")).toBeInTheDocument();
    expect(screen.getAllByText("Équipe 1").length).toBeGreaterThan(0);
  });

  it("displays last sync timestamp when available", () => {
    mockUseEquipes.mockReturnValue({
      data: {
        groups: [],
        lastSync: "2024-01-15T10:30:00.000Z",
      },
      isLoading: false,
      isError: false,
    });
    renderPage();
    expect(screen.getByText(/Dernière mise à jour/)).toBeInTheDocument();
  });
});
