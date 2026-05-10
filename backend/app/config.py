from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    deepseek_api_key: str = Field(..., alias="DEEPSEEK_API_KEY")
    deepseek_base_url: str = Field("https://api.deepseek.com", alias="DEEPSEEK_BASE_URL")

    class Config:
        env_file = ".env"          # 自动读取 .env 文件
        extra = "ignore"           # 忽略其他未定义的变量

settings = Settings()