"""Tests for anko_core.dice.engine."""

import random

import pytest

from anko_core.dice.engine import DiceResult, JudgeOutcome, JudgeResult, dice_roll, dice_judge


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
