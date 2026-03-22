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

import { useJoueurs } from "../../hooks/use-joueurs.js";

const mockUseJoueurs = useJoueurs as ReturnType<typeof vi.fn>;

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
    type_licence: "T",
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
  });

  it("renders the page title", () => {
    mockUseJoueurs.mockReturnValue({
      data: { data: [], lastSync: null },
      isLoading: false,
    });
    renderPage();
    expect(screen.getByText("Progression individuelle")).toBeInTheDocument();
  });

  it("renders category and sex filter pills", () => {
    mockUseJoueurs.mockReturnValue({
      data: { data: [], lastSync: null },
      isLoading: false,
    });
    renderPage();
    expect(screen.getByRole("group", { name: /catégorie/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /sexe/i })).toBeInTheDocument();
  });

  it("shows loading skeleton when loading", () => {
    mockUseJoueurs.mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    renderPage();
    const skeleton = document.querySelector(".animate-pulse");
    expect(skeleton).toBeInTheDocument();
  });

  it("renders joueurs sorted by points descending", () => {
    mockUseJoueurs.mockReturnValue({
      data: { data: MOCK_JOUEURS, lastSync: null },
      isLoading: false,
    });
    renderPage();
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Dupont");
    expect(rows[2]).toHaveTextContent("Martin");
  });

  it("shows progression colors", () => {
    mockUseJoueurs.mockReturnValue({
      data: { data: MOCK_JOUEURS, lastSync: null },
      isLoading: false,
    });
    renderPage();
    expect(screen.getByText("+20")).toBeInTheDocument();
    expect(screen.getByText("-15")).toBeInTheDocument();
  });

  it("filters by category", () => {
    mockUseJoueurs.mockReturnValue({
      data: { data: MOCK_JOUEURS, lastSync: null },
      isLoading: false,
    });
    renderPage();
    const categoryGroup = screen.getByRole("group", { name: /catégorie/i });
    const sPill = categoryGroup.querySelector("button:nth-child(7)")!;
    fireEvent.click(sPill);
    expect(screen.getByText("Dupont Jean")).toBeInTheDocument();
    expect(screen.queryByText("Martin Alice")).not.toBeInTheDocument();
  });
});
