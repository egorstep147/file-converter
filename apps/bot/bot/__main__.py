"""Entry point: python -m bot"""

import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.types import BotCommand, MenuButtonWebApp, WebAppInfo
from aiohttp import web

from .config import load
from .handlers import router
from .webapp import make_app


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    cfg = load()
    bot = Bot(cfg.bot_token, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher()
    dp.include_router(router)
    # the blue menu button next to the input field opens the Mini App
    await bot.set_chat_menu_button(
        menu_button=MenuButtonWebApp(text="Converter", web_app=WebAppInfo(url=cfg.webapp_url + "/"))
    )
    await bot.set_my_commands([BotCommand(command="start", description="Help / Справка")])
    if cfg.api_port:  # Mini App "Send to chat" (behind Caddy with HTTPS on the server)
        runner = web.AppRunner(make_app(bot, cfg))
        await runner.setup()
        await web.TCPSite(runner, "0.0.0.0", cfg.api_port).start()
        logging.info("mini app api on :%d", cfg.api_port)
    await dp.start_polling(bot, cfg=cfg, sem=asyncio.Semaphore(cfg.workers))


if __name__ == "__main__":
    asyncio.run(main())
