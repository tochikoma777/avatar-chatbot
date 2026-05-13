# backend/app/core/tools.py
import datetime
import random

# 工具1：获取当前时间
def get_current_time() -> str:
    """返回当前的实际时间"""
    now = datetime.datetime.now()
    return now.strftime("%Y年%m月%d日 %H:%M:%S")

# 工具2：讲一个趣味知识
def get_fun_fact() -> str:
    """随机返回一条趣味冷知识"""
    facts = [
        "蜂鸟是唯一能够倒飞的鸟。",
        "考拉的指纹与人类的指纹几乎无法区分。",
        "一勺蜂蜜需要12只蜜蜂一生的采集。",
        "章鱼有三颗心脏，血液是蓝色的。",
        "当你脸红时，你的胃也会变红。",
    ]
    return random.choice(facts)

# 可用的工具列表，格式需符合 OpenAI Function Calling
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_current_time",
            "description": "获取当前精确时间，当用户询问时间、日期时调用。",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_fun_fact",
            "description": "返回一条有趣的冷知识，当用户说“讲个冷知识”、“有什么好玩的事情”等时调用。",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    }
]

# 根据函数名执行工具
def execute_tool(tool_name: str):
    if tool_name == "get_current_time":
        return get_current_time()
    elif tool_name == "get_fun_fact":
        return get_fun_fact()
    else:
        return "未知工具调用"