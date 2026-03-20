# BGforge MLS IElib
[![Telegram](https://img.shields.io/badge/telegram-join%20%20%20%20%E2%9D%B1%E2%9D%B1%E2%9D%B1-darkorange?logo=telegram)](https://t.me/bgforge)
[![Discord](https://img.shields.io/discord/420268540700917760?logo=discord&label=discord&color=blue&logoColor=FEE75C)](https://discord.gg/4Yqfggm)
[![IRC](https://img.shields.io/badge/%23IRC-join%20%20%20%20%E2%9D%B1%E2%9D%B1%E2%9D%B1-darkorange)](https://bgforge.net/irc)
[![Patreon](https://img.shields.io/badge/Patreon-donate-FF424D?logo=Patreon&labelColor=141518)](https://www.patreon.com/BGforge)

[__Documentation__](https://ielib.bgforge.net)
| [__Forum__](https://forums.bgforge.net/viewforum.php?f=35)

![usage example](resources/example.png)

A WeiDU library for Infinity Engine modding.

IElib defines various constants: opcode numbers, icon numbers, etc, so that they could be used instead of magic numbers, improving overall code readability - similarly to what WeiDU itself [does](https://weidu.org/~thebigg/README-WeiDU.html#sec58), but on a larger scale. It also contains a collection of helper functions.

IElib can be used standalone or with [BGforge MLS](https://github.com/BGforgeNet/VScode-BGforge-MLS). MLS will pick up all of IElib's define for intellisense.


### Usage

1. Init submodule
    ```bash
    cd mymod
    git submodule add -b master https://github.com/BGforgeNet/ielib.git lib/bgforge
    git commit -m "added BGforge IElib"
    ```
    (__Note:__ once you've added a submodule to your repo, new clones will require an additional step: `git submodule update --init --recursive`.)
2. Enable
    ```
    ALWAYS
      OUTER_SPRINT BGFORGE_LIB_DIR "%MOD_FOLDER%/lib/bgforge"
      INCLUDE ~%BGFORGE_LIB_DIR%/main.tpa~
    END
    ```
3. Browse the code to see the available constants, use [BGforge MLS](https://github.com/BGforgeNet/VScode-BGforge-MLS) to get tips (completion and stuff).

### Update

```bash
git submodule update --remote
git add lib/bgforge
git commit -m "updated BGforge IElib"
```
