"""Tests for anko_dice MCP server tool functions."""

import random

import pytest

from anko_dice.server import dice_roll, dice_judge, dice_range_map, dice_contest, dice_multi


class TestDiceRollTool:
    def test_returns_dict(self):
        random.seed(42)
        result = dice_roll("1d20")
        assert isinstance(result, dict)
        assert "expression" in result
        assert "rolls" in result
        assert "modifier" in result
        assert "total" in result

    def test_values_match_engine(self):
        random.seed(42)
        result = dice_roll("2d6+3")
        assert result["expression"] == "2d6+3"
        assert len(result["rolls"]) == 2
        assert result["modifier"] == 3
        assert result["total"] == sum(result["rolls"]) + 3

    def test_invalid_expression(self):
        with pytest.raises(ValueError):
            dice_roll("invalid")


class TestDiceJudgeTool:
    def test_returns_dict_with_outcome(self):
        result = dice_judge(expression="1d20", threshold=10)
        assert isinstance(result, dict)
        assert result["outcome"] in ("critical_success", "success", "failure", "critical_failure")
        assert "roll" in result
        assert "threshold" in result
        assert "total" in result

    def test_with_crits(self):
        from unittest.mock import patch
        with patch("anko_core.dice.engine.random.randint", return_value=20):
            result = dice_judge(
                expression="1d20",
                threshold=10,
                critical_success_on=20,
            )
            assert result["outcome"] == "critical_success"

    def test_multi_die_with_crits_rejected(self):
        with pytest.raises(ValueError, match="single-die expression"):
            dice_judge(
                expression="2d6",
                threshold=10,
                critical_success_on=12,
            )


class TestDiceRangeMapTool:
    def test_returns_dict_with_label(self):
        result = dice_range_map(
            expression="1d100",
            ranges={"white": [1, 35], "green": [36, 60], "blue": [61, 85], "gold": [86, 100]},
        )
        assert isinstance(result, dict)
        assert "roll" in result
        assert "label" in result
        assert result["label"] in ("white", "green", "blue", "gold")


class TestDiceContestTool:
    def test_returns_dict_with_winner(self):
        random.seed(42)
        result = dice_contest(expr_a="1d20", expr_b="1d20")
        assert isinstance(result, dict)
        assert result["winner"] in ("a", "b", "tie")
        assert "expression_a" in result
        assert "expression_b" in result


class TestDiceMultiTool:
    def test_returns_list_of_dicts(self):
        random.seed(42)
        result = dice_multi(expressions=["1d20", "2d6"])
        assert isinstance(result, list)
        assert len(result) == 2
        assert all(isinstance(r, dict) for r in result)

    def test_empty_list(self):
        result = dice_multi(expressions=[])
        assert result == []
