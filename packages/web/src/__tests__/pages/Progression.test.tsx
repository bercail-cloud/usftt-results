import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { Progression } from "../../pages/Progression.js";

vi.mock("../../hooks/use-joueurs.js", () => ({
  useJoueurs: vi.fn(),
  useJoueurProgression: vi.fn(),
  useJoueurParties: vi.fn(),
}));

import {
  useJoueurs,
  useJoueurProgression,
  useJoueurParties,
} from "../../hooks/use-joueurs.js";

const mockUseJoueurs = useJoueurs as ReturnType<typeof vi.fn>;
const mockUseJoueurProgression = useJoueurProgression as ReturnType<typeof vi.fn>;
const mockUseJoueurParties = useJoueurParties as ReturnType<typeof vi.fn>;

const MOCK_JOUEURS = [
  {
    licence: "123456",
    nom: "Dupont",
    prenom: "Jean",
    points_officiels: 1500,
    points_mensuels: 1510.5,
    ancien_points_mensuels: 1490,
    points_initm: 1450,
    categorie: "S",
    type_licence: "T",
    sexe: "M",
    nb_matchs: 12,
    progression_mensuelle: 20,
  },
  {
    licence: "789012",
    nom: "Martin",
    prenom: "Alice",
    points_officiels: 1200,
    points_mensuels: 1195,
    ancien_points_mensuels: 1210,
    points_initm: 1180,
    categorie: "J",
    type_licence: "P",
    sexe: "F",
    nb_matchs: 8,
    progression_mensuelle: -15,
  },
];

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderPage() {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={["/progression"]}>
        <Progression />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Progression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseJoueurProgression.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });
    mockUseJoueurParties.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });
  });

  it("renders the page title", () => {
    mockUseJoueurs.mockReturnValue({
      data: { data: [], lastSync: null },
      isLoading: false,
      isError: false,
    });

    renderPage();
    expect(screen.getByText("Progression individuelle")).toBeInTheDocument();
  });

  it("renders category filter pills", () => {
    mockUseJoueurs.mockReturnValue({
      data: { data: [], lastSync: null },
      isLoading: false,
      isError: false,
    });

    renderPage();
    expect(screen.getByRole("group", { name: /catégorie/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /sexe/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /type de licence/i })).toBeInTheDocument();
  });

  it("shows loading skeleton when joueurs are loading", () => {
    mockUseJoueurs.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    renderPage();
    const skeleton = document.querySelector(".animate-pulse");
    expect(skeleton).toBeInTheDocument();
  });

  it("shows empty state when no joueurs match filters", () => {
    mockUseJoueurs.mockReturnValue({
      data: { data: [], lastSync: null },
      isLoading: false,
      isError: false,
    });

    renderPage();
    expect(
      screen.getByText(/Aucun joueur ne correspond aux filtres/)
    ).toBeInTheDocument();
  });

  it("renders joueurs in the overview table", () => {
    mockUseJoueurs.mockReturnValue({
      data: { data: MOCK_JOUEURS, lastSync: null },
      isLoading: false,
      isError: false,
    });

    renderPage();
    expect(screen.getByText("Dupont Jean")).toBeInTheDocument();
    expect(screen.getByText("Martin Alice")).toBeInTheDocument();
  });

  it("shows table sorted by points_officiels descending", () => {
    mockUseJoueurs.mockReturnValue({
      data: { data: MOCK_JOUEURS, lastSync: null },
      isLoading: false,
      isError: false,
    });

    renderPage();
    const rows = screen.getAllByRole("row");
    // First data row (index 1) should be Dupont (1500 pts > 1200 pts)
    expect(rows[1]).toHaveTextContent("Dupont");
    expect(rows[2]).toHaveTextContent("Martin");
  });

  it("shows positive progression in green and negative in red", () => {
    mockUseJoueurs.mockReturnValue({
      data: { data: MOCK_JOUEURS, lastSync: null },
      isLoading: false,
      isError: false,
    });

    renderPage();
    expect(screen.getByText("+20")).toBeInTheDocument();
    expect(screen.getByText("-15")).toBeInTheDocument();
  });

  it("does not show detail section before a player is selected", () => {
    mockUseJoueurs.mockReturnValue({
      data: { data: MOCK_JOUEURS, lastSync: null },
      isLoading: false,
      isError: false,
    });

    renderPage();
    expect(screen.queryByText("Evolution des points")).not.toBeInTheDocument();
    expect(screen.queryByText("Parties")).not.toBeInTheDocument();
  });

  it("shows player detail section after clicking a row", () => {
    mockUseJoueurs.mockReturnValue({
      data: { data: MOCK_JOUEURS, lastSync: null },
      isLoading: false,
      isError: false,
    });
    mockUseJoueurProgression.mockReturnValue({
      data: { data: [] },
      isLoading: false,
      isError: false,
    });
    mockUseJoueurParties.mockReturnValue({
      data: { data: [] },
      isLoading: false,
      isError: false,
    });

    renderPage();

    const row = screen.getByText("Dupont Jean").closest("tr")!;
    fireEvent.click(row);

    expect(screen.getByText("Evolution des points")).toBeInTheDocument();
    expect(screen.getByText("Parties")).toBeInTheDocument();
  });

  it("filters joueurs by category when a filter pill is clicked", () => {
    mockUseJoueurs.mockReturnValue({
      data: { data: MOCK_JOUEURS, lastSync: null },
      isLoading: false,
      isError: false,
    });

    renderPage();

    // Both players visible initially
    expect(screen.getByText("Dupont Jean")).toBeInTheDocument();
    expect(screen.getByText("Martin Alice")).toBeInTheDocument();

    // Click "S" category filter
    const categoryGroup = screen.getByRole("group", { name: /catégorie/i });
    const sPill = categoryGroup.querySelector("button:nth-child(2)")!;
    fireEvent.click(sPill);

    // Only Senior player visible
    expect(screen.getByText("Dupont Jean")).toBeInTheDocument();
    expect(screen.queryByText("Martin Alice")).not.toBeInTheDocument();
  });
});
