"""Dice calculation engine — pure functions, no MCP dependency."""

from __future__ import annotations

import random
import re
from dataclasses import dataclass
from enum import Enum


@dataclass
class DiceResult:
    """Result of a dice roll."""

    expression: str
    rolls: list[int]
    modifier: int
    total: int


_DICE_PATTERN = re.compile(r"^(\d+)[dD](\d+)([+-]\d+)?$")


def dice_roll(expression: str) -> DiceResult:
    """Roll dice using NdS[+M] syntax.

    Examples: 1d20, 2d6+3, 1d100, 1D20-2
    """
    match = _DICE_PATTERN.match(expression)
    if not match:
        raise ValueError(f"Invalid dice expression: {expression}")

    count = int(match.group(1))
    sides = int(match.group(2))
    modifier = int(match.group(3)) if match.group(3) else 0

    if count < 1:
        raise ValueError(f"Number of dice must be at least 1, got {count}")
    if sides < 2:
        raise ValueError(f"Number of sides must be at least 2, got {sides}")

    rolls = [random.randint(1, sides) for _ in range(count)]
    total = sum(rolls) + modifier

    return DiceResult(
        expression=expression,
        rolls=rolls,
        modifier=modifier,
        total=total,
    )


class JudgeOutcome(Enum):
    """Outcome of a dice judgment."""

    CRITICAL_SUCCESS = "critical_success"
    SUCCESS = "success"
    FAILURE = "failure"
    CRITICAL_FAILURE = "critical_failure"


@dataclass
class JudgeResult:
    """Result of judging a dice roll against a threshold."""

    roll: int
    threshold: int
    modifier: int
    total: int
    outcome: JudgeOutcome


def dice_judge(
    roll: int,
    threshold: int,
    modifier: int = 0,
    critical_success_on: int | None = None,
    critical_failure_on: int | None = None,
) -> JudgeResult:
    """Judge a roll value against a threshold.

    Criticals take priority: if the natural roll matches a crit, that
    outcome is forced regardless of total vs threshold.
    """
    total = roll + modifier

    if critical_failure_on is not None and roll == critical_failure_on:
        outcome = JudgeOutcome.CRITICAL_FAILURE
    elif critical_success_on is not None and roll == critical_success_on:
        outcome = JudgeOutcome.CRITICAL_SUCCESS
    elif total >= threshold:
        outcome = JudgeOutcome.SUCCESS
    else:
        outcome = JudgeOutcome.FAILURE

    return JudgeResult(
        roll=roll,
        threshold=threshold,
        modifier=modifier,
        total=total,
        outcome=outcome,
    )


@dataclass
class RangeMapResult:
    """Result of mapping a roll to a range label."""

    roll: int
    label: str
    range_definition: dict[str, list[int]]


def dice_range_map(roll: int, ranges: dict[str, list[int]]) -> RangeMapResult:
    """Map a roll value to a label based on range definitions.

    Example: {"white": [1, 35], "green": [36, 60], "blue": [61, 85]}
    """
    for label, bounds in ranges.items():
        if len(bounds) != 2:
            raise ValueError(
                f"Range for '{label}' must have exactly 2 values, got {len(bounds)}"
            )
        low, high = bounds
        if low > high:
            raise ValueError(
                f"Range for '{label}' has inverted bounds: low ({low}) > high ({high})"
            )
        if low <= roll <= high:
            return RangeMapResult(
                roll=roll,
                label=label,
                range_definition=ranges,
            )
    raise ValueError(f"Roll {roll} does not fall into any defined range")


@dataclass
class ContestResult:
    """Result of a contest between two dice expressions."""

    expression_a: DiceResult
    expression_b: DiceResult
    winner: str  # "a", "b", or "tie"


def dice_contest(expr_a: str, expr_b: str) -> ContestResult:
    """Roll two dice expressions and compare results."""
    result_a = dice_roll(expr_a)
    result_b = dice_roll(expr_b)

    if result_a.total > result_b.total:
        winner = "a"
    elif result_b.total > result_a.total:
        winner = "b"
    else:
        winner = "tie"

    return ContestResult(
        expression_a=result_a,
        expression_b=result_b,
        winner=winner,
    )


def dice_multi(expressions: list[str]) -> list[DiceResult]:
    """Roll multiple dice expressions at once."""
    return [dice_roll(expr) for expr in expressions]

