import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { CriteriumOverview } from "../../pages/CriteriumOverview.js";

vi.mock("../../hooks/use-criterium.js", () => ({
  useCriteriumTours: vi.fn(),
  useCriteriumTour: vi.fn(),
  useCriteriumDetail: vi.fn(),
}));

import { useCriteriumTours, useCriteriumTour } from "../../hooks/use-criterium.js";

const mockUseCriteriumTours = useCriteriumTours as ReturnType<typeof vi.fn>;
const mockUseCriteriumTour = useCriteriumTour as ReturnType<typeof vi.fn>;

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderPage() {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={["/criterium"]}>
        <CriteriumOverview />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const emptyTourData = {
  data: { tour: 1, saison: "2024-2025", lastSync: null, joueurs: [] },
  isLoading: false,
  isError: false,
};

describe("CriteriumOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCriteriumTour.mockReturnValue(emptyTourData);
  });

  it("renders the page title", () => {
    mockUseCriteriumTours.mockReturnValue({
      data: { tours: [1, 2], saison: "2024-2025", lastSync: null },
      isLoading: false,
      isError: false,
    });

    renderPage();
    expect(screen.getByText(/Criterium Federal/)).toBeInTheDocument();
  });

  it("renders tour tabs", () => {
    mockUseCriteriumTours.mockReturnValue({
      data: { tours: [1, 2], saison: "2024-2025", lastSync: null },
      isLoading: false,
      isError: false,
    });

    renderPage();
    expect(screen.getByText("Tour 1")).toBeInTheDocument();
    expect(screen.getByText("Tour 2")).toBeInTheDocument();
    expect(screen.getByText("Tour 3")).toBeInTheDocument();
    expect(screen.getByText("Tour 4")).toBeInTheDocument();
  });

  it("shows loading skeleton when tours are loading", () => {
    mockUseCriteriumTours.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    renderPage();
    const skeleton = document.querySelector(".animate-pulse");
    expect(skeleton).toBeInTheDocument();
  });

  it("shows empty state when no joueurs in tour", () => {
    mockUseCriteriumTours.mockReturnValue({
      data: { tours: [1], saison: "2024-2025", lastSync: null },
      isLoading: false,
      isError: false,
    });

    renderPage();
    expect(screen.getByText("Aucun resultat pour ce tour")).toBeInTheDocument();
  });

  it("renders joueurs when data is available", () => {
    mockUseCriteriumTours.mockReturnValue({
      data: { tours: [1], saison: "2024-2025", lastSync: null },
      isLoading: false,
      isError: false,
    });

    mockUseCriteriumTour.mockReturnValue({
      data: {
        tour: 1,
        saison: "2024-2025",
        lastSync: null,
        joueurs: [
          {
            licence: "123456",
            nom: "Dupont",
            prenom: "Jean",
            division: "P",
            classement: "1500",
            victoires: 3,
            defaites: 1,
            rang: 2,
            total_joueurs: 10,
            points: 2,
          },
        ],
      },
      isLoading: false,
      isError: false,
    });

    renderPage();
    expect(screen.getAllByText("Jean Dupont").length).toBeGreaterThan(0);
  });

  it("switches active tour when tab is clicked", () => {
    mockUseCriteriumTours.mockReturnValue({
      data: { tours: [1, 2], saison: "2024-2025", lastSync: null },
      isLoading: false,
      isError: false,
    });

    renderPage();
    const tour2Tab = screen.getByText("Tour 2");
    fireEvent.click(tour2Tab);

    expect(mockUseCriteriumTour).toHaveBeenCalledWith(2);
  });

  it("displays last sync timestamp when available", () => {
    mockUseCriteriumTours.mockReturnValue({
      data: {
        tours: [1],
        saison: "2024-2025",
        lastSync: "2024-01-15T10:30:00.000Z",
      },
      isLoading: false,
      isError: false,
    });

    renderPage();
    expect(screen.getByText(/Derniere mise a jour/)).toBeInTheDocument();
  });
});
