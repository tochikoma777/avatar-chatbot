"""Agent 可用工具集。

所有工具都必须是纯函数式的（无副作用、可快速返回），
注册在 TOOL_REGISTRY 中，供 Function Calling 调用。
"""

import ast
import datetime
import inspect
import json
import logging
import operator
import random
import re

import httpx

logger = logging.getLogger(__name__)

WEEKDAYS = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"]


# --------------------------------------------------------------------------- #
# 工具实现
# --------------------------------------------------------------------------- #
def get_current_time() -> str:
    """获取当前日期、时间与星期。"""
    now = datetime.datetime.now()
    return f"{now.strftime('%Y年%m月%d日')} {WEEKDAYS[now.weekday()]} {now.strftime('%H:%M:%S')}"


def get_fun_fact() -> str:
    """随机返回一条趣味冷知识。"""
    facts = [
        "蜂鸟是唯一能够倒着飞的鸟。",
        "考拉的指纹与人类的指纹在显微镜下几乎无法区分。",
        "一勺蜂蜜大约需要 12 只蜜蜂一生的采集量。",
        "章鱼有三颗心脏，而且血液是蓝色的。",
        "人在脸红的时候，胃壁也会跟着变红。",
        "香蕉其实是浆果，而草莓在植物学上并不是。",
        "猫咪的呼噜声频率大约在 25~150 赫兹，被认为有助于骨骼恢复。",
        "天空之所以是蓝色的，是因为空气分子更容易散射短波长的光。",
        "人脑在休息时的耗氧量仍占全身的 20% 左右。",
        "南极洲是地球上最干燥的大陆，部分地区数百万年没有下过雨。",
    ]
    return random.choice(facts)


async def get_weather(city: str = "北京") -> str:
    """查询城市天气（免费 wttr.in 服务，失败时给出友好提示）。"""
    city = (city or "北京").strip()[:32]
    url = f"https://wttr.in/{city}"
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            resp = await client.get(
                url,
                params={"format": "j1"},
                headers={"User-Agent": "avatar-chatbot/1.0"},
            )
            resp.raise_for_status()
            data = resp.json()
        current = data["current_condition"][0]
        area = data.get("nearest_area", [{}])[0].get("areaName", [{}])[0].get("value", city)
        desc = current["weatherDesc"][0]["value"]
        temp = current["temp_C"]
        feels = current["FeelsLikeC"]
        humidity = current["humidity"]
        wind = current["windspeedKmph"]
        return f"{area}：{desc}，气温 {temp}℃（体感 {feels}℃），湿度 {humidity}%，风速 {wind} km/h。"
    except Exception as exc:  # noqa: BLE001 - 外部服务，任何异常都降级
        logger.warning("Weather lookup failed for %s: %s", city, exc)
        return f"暂时没能查到{city}的天气（网络不通或服务限流），可以稍后再试一次。"


def roll_dice(sides: int = 6, times: int = 1) -> str:
    """掷骰子，返回点数与总和。"""
    sides = max(2, min(int(sides), 100))
    times = max(1, min(int(times), 10))
    results = [random.randint(1, sides) for _ in range(times)]
    total = sum(results)
    detail = "、".join(str(r) for r in results)
    return f"掷 {times} 次 {sides} 面骰：{detail}，合计 {total}。"


_ALLOWED_BINOPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
}
_ALLOWED_UNARY = {ast.UAdd: operator.pos, ast.USub: operator.neg}


def calculate(expression: str = "") -> str:
    """安全地计算数学表达式（只允许数字与基础运算符）。"""
    expr = (expression or "").strip().replace("×", "*").replace("÷", "/").replace("^", "**")
    expr = re.sub(r"[，,\s]", "", expr)
    if not expr or len(expr) > 120:
        return "表达式为空或过长，请输入类似 (12+8)*3 的式子。"

    try:
        tree = ast.parse(expr, mode="eval")
    except SyntaxError:
        return f"看不懂这个表达式：{expression}"

    def _eval(node: ast.AST) -> float:
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return float(node.value)
        if isinstance(node, ast.BinOp) and type(node.op) in _ALLOWED_BINOPS:
            left, right = _eval(node.left), _eval(node.right)
            if isinstance(node.op, ast.Pow) and abs(right) > 64:
                raise ValueError("指数过大")
            return _ALLOWED_BINOPS[type(node.op)](left, right)
        if isinstance(node, ast.UnaryOp) and type(node.op) in _ALLOWED_UNARY:
            return _ALLOWED_UNARY[type(node.op)](_eval(node.operand))
        raise ValueError("包含不支持的运算")

    try:
        value = _eval(tree.body)
    except ZeroDivisionError:
        return "除数不能为 0 哦。"
    except Exception:  # noqa: BLE001
        return f"这个式子算不出来：{expression}"

    if value == int(value) and abs(value) < 1e15:
        return f"{expression} = {int(value)}"
    return f"{expression} = {round(value, 6)}"


def get_anime_quote() -> str:
    """随机来一句二次元台词。"""
    quotes = [
        "「如果温柔是罪，那我早就被判无期了。」",
        "「即使世界毁灭，我也会站在你这边。」",
        "「哭出来也没关系，眼泪又不是什么丢人的东西。」",
        "「重要的不是起点，而是你愿意迈出的那一步。」",
        "「星星即使在白天也一直都在，只是看不见而已。」",
        "「与其叹息，不如把今天过得闪闪发亮。」",
        "「约定好了，明天也要在这里见面哦。」",
    ]
    return random.choice(quotes)


def pick_random(options: str = "") -> str:
    """帮用户做选择，从逗号分隔的选项中随机挑一个。"""
    items = [opt.strip() for opt in re.split(r"[,，、/|]", options or "") if opt.strip()]
    if len(items) < 2:
        return "请至少给我两个选项，比如「吃火锅,吃烤肉,吃拉面」。"
    return f"我帮你选：{random.choice(items)}！"


# --------------------------------------------------------------------------- #
# 注册表 & OpenAI Function Calling schema
# --------------------------------------------------------------------------- #
TOOL_REGISTRY: dict[str, callable] = {
    "get_current_time": get_current_time,
    "get_fun_fact": get_fun_fact,
    "get_weather": get_weather,
    "roll_dice": roll_dice,
    "calculate": calculate,
    "get_anime_quote": get_anime_quote,
    "pick_random": pick_random,
}

TOOLS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "get_current_time",
            "description": "获取当前日期、星期与精确时间。当用户询问时间、日期、今天几号时调用。",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_fun_fact",
            "description": "随机返回一条有趣的冷知识。当用户想听冷知识、想听点好玩的事时调用。",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "查询指定城市的实时天气。用户提到天气、下雨、要不要带伞时调用。",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "城市名，例如 北京、上海、Tokyo"}
                },
                "required": ["city"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "roll_dice",
            "description": "掷骰子或生成随机数。用户要掷骰子、抽签、决定顺序时调用。",
            "parameters": {
                "type": "object",
                "properties": {
                    "sides": {"type": "integer", "description": "骰子面数，默认 6", "default": 6},
                    "times": {"type": "integer", "description": "掷几次，默认 1", "default": 1},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calculate",
            "description": "计算数学表达式，支持 + - * / % 与括号。用户要做算术时调用。",
            "parameters": {
                "type": "object",
                "properties": {
                    "expression": {"type": "string", "description": "要计算的表达式，例如 (12+8)*3"}
                },
                "required": ["expression"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_anime_quote",
            "description": "随机来一句二次元风格台词。用户想听台词、想要鼓励或中二一下时调用。",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "pick_random",
            "description": "帮助用户做选择，从多个选项中随机挑一个。用户纠结吃什么/去哪时调用。",
            "parameters": {
                "type": "object",
                "properties": {
                    "options": {"type": "string", "description": "逗号分隔的选项，例如 火锅,烤肉,拉面"}
                },
                "required": ["options"],
            },
        },
    },
]

# 前端展示用的友好名称
TOOL_LABELS: dict[str, str] = {
    "get_current_time": "查询时间",
    "get_fun_fact": "冷知识",
    "get_weather": "天气查询",
    "roll_dice": "掷骰子",
    "calculate": "计算器",
    "get_anime_quote": "台词库",
    "pick_random": "选择困难症",
}


async def execute_tool(name: str, arguments: str | dict | None = None) -> str:
    """按名称执行工具，自动解析 JSON 参数。"""
    func = TOOL_REGISTRY.get(name)
    if not func:
        return f"未注册的工具：{name}"

    args: dict = {}
    if isinstance(arguments, dict):
        args = arguments
    elif arguments:
        try:
            args = json.loads(arguments)
        except json.JSONDecodeError:
            logger.warning("Invalid tool arguments for %s: %s", name, arguments)
            args = {}
    if not isinstance(args, dict):
        args = {}

    try:
        result = func(**args)
        if inspect.isawaitable(result):
            result = await result
        return str(result)
    except TypeError:
        try:
            result = func()
            if inspect.isawaitable(result):
                result = await result
            return str(result)
        except Exception as exc:  # noqa: BLE001
            return f"工具执行失败：{exc}"
    except Exception as exc:  # noqa: BLE001
        logger.exception("Tool %s failed", name)
        return f"工具执行失败：{exc}"
