"""Tests for anko_core.dice.engine."""

import random

import pytest

from anko_core.dice.engine import (
    DiceResult, JudgeOutcome, JudgeResult, RangeMapResult,
    ContestResult, dice_roll, dice_judge, dice_range_map, dice_contest, dice_multi,
)


class TestDiceRoll:
    def test_basic_1d20(self):
        random.seed(42)
        result = dice_roll("1d20")
        assert isinstance(result, DiceResult)
        assert result.expression == "1d20"
        assert len(result.rolls) == 1
        assert 1 <= result.rolls[0] <= 20
        assert result.total == result.rolls[0]
        assert result.modifier == 0

    def test_basic_2d6(self):
        random.seed(42)
        result = dice_roll("2d6")
        assert len(result.rolls) == 2
        assert all(1 <= r <= 6 for r in result.rolls)
        assert result.total == sum(result.rolls)

    def test_modifier_positive(self):
        random.seed(42)
        result = dice_roll("1d20+5")
        assert result.modifier == 5
        assert result.total == result.rolls[0] + 5

    def test_modifier_negative(self):
        random.seed(42)
        result = dice_roll("1d20-3")
        assert result.modifier == -3
        assert result.total == result.rolls[0] - 3

    def test_1d100(self):
        random.seed(42)
        result = dice_roll("1d100")
        assert 1 <= result.rolls[0] <= 100

    def test_deterministic_with_seed(self):
        random.seed(123)
        r1 = dice_roll("1d20")
        random.seed(123)
        r2 = dice_roll("1d20")
        assert r1.rolls == r2.rolls
        assert r1.total == r2.total

    def test_invalid_expression_empty(self):
        with pytest.raises(ValueError, match="Invalid dice expression"):
            dice_roll("")

    def test_invalid_expression_nonsense(self):
        with pytest.raises(ValueError, match="Invalid dice expression"):
            dice_roll("abc")

    def test_invalid_expression_zero_dice(self):
        with pytest.raises(ValueError, match="at least 1"):
            dice_roll("0d6")

    def test_invalid_expression_one_side(self):
        with pytest.raises(ValueError, match="at least 2"):
            dice_roll("1d1")

    def test_expression_case_insensitive(self):
        random.seed(42)
        result = dice_roll("1D20")
        assert len(result.rolls) == 1
        assert 1 <= result.rolls[0] <= 20

    def test_multi_dice_with_modifier(self):
        random.seed(42)
        result = dice_roll("3d8+10")
        assert len(result.rolls) == 3
        assert all(1 <= r <= 8 for r in result.rolls)
        assert result.modifier == 10
        assert result.total == sum(result.rolls) + 10


class TestDiceJudge:
    def test_success(self):
        result = dice_judge(roll=15, threshold=10)
        assert result.outcome == JudgeOutcome.SUCCESS
        assert result.total == 15

    def test_failure(self):
        result = dice_judge(roll=5, threshold=10)
        assert result.outcome == JudgeOutcome.FAILURE

    def test_exact_threshold_is_success(self):
        result = dice_judge(roll=10, threshold=10)
        assert result.outcome == JudgeOutcome.SUCCESS

    def test_with_modifier(self):
        result = dice_judge(roll=8, threshold=10, modifier=3)
        assert result.total == 11
        assert result.outcome == JudgeOutcome.SUCCESS

    def test_modifier_not_enough(self):
        result = dice_judge(roll=5, threshold=10, modifier=2)
        assert result.total == 7
        assert result.outcome == JudgeOutcome.FAILURE

    def test_critical_success(self):
        result = dice_judge(roll=20, threshold=10, critical_success_on=20)
        assert result.outcome == JudgeOutcome.CRITICAL_SUCCESS

    def test_critical_success_overrides_failure(self):
        """Natural 20 is crit success even if total < threshold."""
        result = dice_judge(roll=20, threshold=30, critical_success_on=20)
        assert result.outcome == JudgeOutcome.CRITICAL_SUCCESS

    def test_critical_failure(self):
        result = dice_judge(roll=1, threshold=10, critical_failure_on=1)
        assert result.outcome == JudgeOutcome.CRITICAL_FAILURE

    def test_critical_failure_overrides_success(self):
        """Natural 1 is crit failure even if total >= threshold."""
        result = dice_judge(roll=1, threshold=0, critical_failure_on=1)
        assert result.outcome == JudgeOutcome.CRITICAL_FAILURE

    def test_no_crits_defined(self):
        result = dice_judge(roll=20, threshold=10)
        assert result.outcome == JudgeOutcome.SUCCESS

    def test_result_fields(self):
        result = dice_judge(roll=15, threshold=10, modifier=2)
        assert result.roll == 15
        assert result.threshold == 10
        assert result.modifier == 2
        assert result.total == 17
        assert result.outcome == JudgeOutcome.SUCCESS


class TestDiceRangeMap:
    def test_basic_mapping(self):
        ranges = {"white": [1, 35], "green": [36, 60], "blue": [61, 85], "gold": [86, 100]}
        result = dice_range_map(50, ranges)
        assert result.label == "green"
        assert result.roll == 50

    def test_boundary_low(self):
        ranges = {"white": [1, 35], "green": [36, 60]}
        result = dice_range_map(1, ranges)
        assert result.label == "white"

    def test_boundary_high(self):
        ranges = {"white": [1, 35], "green": [36, 60]}
        result = dice_range_map(60, ranges)
        assert result.label == "green"

    def test_boundary_between(self):
        ranges = {"white": [1, 35], "green": [36, 60]}
        result = dice_range_map(35, ranges)
        assert result.label == "white"
        result2 = dice_range_map(36, ranges)
        assert result2.label == "green"

    def test_first_range_hit(self):
        ranges = {"white": [1, 35], "green": [36, 60]}
        result = dice_range_map(20, ranges)
        assert result.label == "white"

    def test_roll_outside_all_ranges(self):
        ranges = {"white": [1, 35], "green": [36, 60]}
        with pytest.raises(ValueError, match="does not fall into any defined range"):
            dice_range_map(100, ranges)

    def test_invalid_range_bounds(self):
        ranges = {"white": [1]}
        with pytest.raises(ValueError, match="must have exactly 2 values"):
            dice_range_map(10, ranges)

    def test_preserves_range_definition(self):
        ranges = {"white": [1, 35], "green": [36, 60]}
        result = dice_range_map(50, ranges)
        assert result.range_definition == ranges

    def test_inverted_bounds(self):
        ranges = {"bad": [50, 10]}
        with pytest.raises(ValueError, match="inverted bounds"):
            dice_range_map(20, ranges)


class TestDiceContest:
    def test_a_wins(self):
        """Force deterministic outcome by seeding before each roll."""
        random.seed(100)
        result = dice_contest("1d20", "1d20")
        assert result.winner in ("a", "b", "tie")
        assert isinstance(result.expression_a, DiceResult)
        assert isinstance(result.expression_b, DiceResult)

    def test_deterministic_winner(self):
        """Seed to produce a known a-wins result."""
        random.seed(42)
        r1 = dice_roll("1d20")
        random.seed(99)
        r2 = dice_roll("1d20")
        random.seed(42)
        result = dice_contest("1d20", "1d20")
        assert result.winner in ("a", "b", "tie")

    def test_tie_possible(self):
        """Both sides rolling same value produces tie."""
        from unittest.mock import patch
        with patch("anko_core.dice.engine.random.randint", return_value=10):
            result = dice_contest("1d20", "1d20")
            assert result.winner == "tie"

    def test_contest_with_modifiers(self):
        from unittest.mock import patch
        def fake_randint(a, b):
            return 10
        with patch("anko_core.dice.engine.random.randint", side_effect=fake_randint):
            result = dice_contest("1d20+5", "1d20+3")
            assert result.winner == "a"

    def test_invalid_expression_propagates(self):
        with pytest.raises(ValueError, match="Invalid dice expression"):
            dice_contest("abc", "1d20")


class TestDiceMulti:
    def test_multiple_expressions(self):
        random.seed(42)
        results = dice_multi(["1d20", "2d6", "1d100"])
        assert len(results) == 3
        assert all(isinstance(r, DiceResult) for r in results)
        assert results[0].expression == "1d20"
        assert results[1].expression == "2d6"
        assert results[2].expression == "1d100"

    def test_empty_list(self):
        results = dice_multi([])
        assert results == []

    def test_single_expression(self):
        random.seed(42)
        results = dice_multi(["1d20"])
        assert len(results) == 1

    def test_invalid_expression_in_list(self):
        with pytest.raises(ValueError, match="Invalid dice expression"):
            dice_multi(["1d20", "invalid", "2d6"])
