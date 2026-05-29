"""anko_dice MCP server — stateless dice tools."""

from __future__ import annotations

from mcp.server.fastmcp import FastMCP

from anko_core.dice import engine as dice_engine

mcp = FastMCP("anko_dice")


@mcp.tool()
def dice_roll(expression: str) -> dict:
    """Roll dice using NdS[+M] syntax. Examples: 1d20, 2d6+3, 1d100-2"""
    result = dice_engine.dice_roll(expression)
    return {
        "expression": result.expression,
        "rolls": result.rolls,
        "modifier": result.modifier,
        "total": result.total,
    }


@mcp.tool()
def dice_judge(
    expression: str,
    threshold: int,
    modifier: int = 0,
    critical_success_on: int | None = None,
    critical_failure_on: int | None = None,
) -> dict:
    """Roll dice and judge against a threshold.

    For critical detection, only single-die expressions are supported
    (crits check the natural die face, not the sum of multiple dice).
    Returns outcome: critical_success, success, failure, or critical_failure.
    """
    roll_result = dice_engine.dice_roll(expression)
    if len(roll_result.rolls) != 1 and (
        critical_success_on is not None or critical_failure_on is not None
    ):
        raise ValueError(
            "Critical thresholds require a single-die expression "
            f'(got {len(roll_result.rolls)} dice in "{expression}")'
        )
    judge_result = dice_engine.dice_judge(
        roll=roll_result.rolls[0] if len(roll_result.rolls) == 1 else roll_result.total,
        threshold=threshold,
        modifier=modifier,
        critical_success_on=critical_success_on,
        critical_failure_on=critical_failure_on,
    )
    return {
        "roll": judge_result.roll,
        "threshold": judge_result.threshold,
        "modifier": judge_result.modifier,
        "total": judge_result.total,
        "outcome": judge_result.outcome.value,
    }


@mcp.tool()
def dice_range_map(
    expression: str,
    ranges: dict[str, list[int]],
) -> dict:
    """Roll dice and map the result to a label based on range definitions.

    Example ranges: {"white": [1, 35], "green": [36, 60], "blue": [61, 85]}
    """
    roll_result = dice_engine.dice_roll(expression)
    map_result = dice_engine.dice_range_map(roll_result.total, ranges)
    return {
        "roll": map_result.roll,
        "label": map_result.label,
        "ranges": map_result.range_definition,
    }


@mcp.tool()
def dice_contest(expr_a: str, expr_b: str) -> dict:
    """Roll two dice expressions and compare results. Winner is 'a', 'b', or 'tie'."""
    result = dice_engine.dice_contest(expr_a, expr_b)
    return {
        "expression_a": {
            "expression": result.expression_a.expression,
            "rolls": result.expression_a.rolls,
            "modifier": result.expression_a.modifier,
            "total": result.expression_a.total,
        },
        "expression_b": {
            "expression": result.expression_b.expression,
            "rolls": result.expression_b.rolls,
            "modifier": result.expression_b.modifier,
            "total": result.expression_b.total,
        },
        "winner": result.winner,
    }


@mcp.tool()
def dice_multi(expressions: list[str]) -> list[dict]:
    """Roll multiple dice expressions at once."""
    results = dice_engine.dice_multi(expressions)
    return [
        {
            "expression": r.expression,
            "rolls": r.rolls,
            "modifier": r.modifier,
            "total": r.total,
        }
        for r in results
    ]


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
