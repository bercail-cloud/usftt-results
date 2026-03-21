import { render, screen } from "@testing-library/react";
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
      data: { joueurs: [] },
      isLoading: false,
      isError: false,
    });

    renderPage();
    expect(screen.getByText("Progression individuelle")).toBeInTheDocument();
  });

  it("renders player selector", () => {
    mockUseJoueurs.mockReturnValue({
      data: { joueurs: [] },
      isLoading: false,
      isError: false,
    });

    renderPage();
    expect(
      screen.getByRole("combobox", { name: /selectionner un joueur/i })
    ).toBeInTheDocument();
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

  it("shows empty state when no player selected", () => {
    mockUseJoueurs.mockReturnValue({
      data: { joueurs: [] },
      isLoading: false,
      isError: false,
    });

    renderPage();
    expect(
      screen.getByText(/Selectionnez un joueur pour voir sa progression/)
    ).toBeInTheDocument();
  });

  it("renders joueurs in selector", () => {
    mockUseJoueurs.mockReturnValue({
      data: {
        joueurs: [
          { licence: "123456", nom: "Dupont", prenom: "Jean", points: 1500 },
          { licence: "789012", nom: "Martin", prenom: "Alice", points: 1200 },
        ],
      },
      isLoading: false,
      isError: false,
    });

    renderPage();
    expect(screen.getByText("Jean Dupont (1500 pts)")).toBeInTheDocument();
    expect(screen.getByText("Alice Martin (1200 pts)")).toBeInTheDocument();
  });
});
