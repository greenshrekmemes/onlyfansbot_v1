#!/usr/bin/env python3
import sys
import asyncio
import os
import traceback

import tests.main_test as main_test

try:

    main_test.version_check()
    main_test.check_config()
    main_test.check_profiles()

    if __name__ == "__main__":
        import datascraper.main_datascraper as main_datascraper
        import helpers.main_helper as main_helper

        config_path = os.path.join(".settings", "config.json")
        json_config, json_config2 = main_helper.get_config(config_path)

        # logging.basicConfig(level=logging.DEBUG, format="%(message)s")
        async def main():
            api = await main_datascraper.start_datascraper(json_config, 'onlyfans', {
                'username': 'default',
                'cookie': sys.argv[2],
                'x_bc': sys.argv[3],
                'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.152 Safari/537.36',
                'email': '', 'password': '', 'hashed': False, 'support_2fa': True, 'active': True}, sys.argv[1])
            print(api)

        asyncio.run(main())
except Exception as e:
    print(traceback.format_exc())
    input()
