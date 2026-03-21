import { render, screen } from "@testing-library/react";
import { ScoreBadge } from "../../components/ScoreBadge";

describe("ScoreBadge", () => {
  it("renders the score in the correct format", () => {
    render(<ScoreBadge scoreA={12} scoreB={6} isVictory={true} />);
    expect(screen.getByText("12 - 6")).toBeInTheDocument();
  });

  it("applies green styling for victory", () => {
    render(<ScoreBadge scoreA={12} scoreB={6} isVictory={true} />);
    const badge = screen.getByText("12 - 6");
    expect(badge).toHaveClass("bg-success-light");
    expect(badge).toHaveClass("text-success");
  });

  it("applies red styling for defeat", () => {
    render(<ScoreBadge scoreA={3} scoreB={9} isVictory={false} />);
    const badge = screen.getByText("3 - 9");
    expect(badge).toHaveClass("bg-error-light");
    expect(badge).toHaveClass("text-error");
  });

  it("renders zero scores correctly", () => {
    render(<ScoreBadge scoreA={0} scoreB={0} isVictory={false} />);
    expect(screen.getByText("0 - 0")).toBeInTheDocument();
  });
});
