---
layout: home
title: Home

hero:
  name: IElib
  text: WeiDU library for Infinity Engine modding.
  tagline: Named constants for opcodes, file offsets, IDS values, and helper functions.
  image:
    src: /example.png
    alt: IElib example
  actions:
    - theme: brand
      text: Get Started
      link: '#usage'
    - theme: alt
      text: Functions
      link: /functions/2da
    - theme: alt
      text: Constants
      link: /constants/ids
    - theme: alt
      text: Types
      link: /types

features:
  - title: Named Constants
    details: Opcode numbers, icon numbers, file structure offsets, and more. No more magic numbers in your code.
  - title: Helper Functions
    details: Ready-made WeiDU functions and macros for common modding tasks -- creatures, items, dialogs, and more.
  - title: MLS Integration
    details: Can be used standalone or with <a href="https://github.com/BGforgeNet/VScode-BGforge-MLS">BGforge MLS</a>. MLS will pick up all of IElib's defines for intellisense.
---

## Usage

### 1. Init submodule

```bash
cd mymod
git submodule add -b master https://github.com/BGforgeNet/ielib.git lib/bgforge
git commit -m "added BGforge IElib"
```

Once you've added a submodule to your repo, new clones will require an additional step: `git submodule update --init --recursive`.

### 2. Enable

```
ALWAYS
  OUTER_SPRINT BGFORGE_LIB_DIR "%MOD_FOLDER%/lib/bgforge"
  INCLUDE ~%BGFORGE_LIB_DIR%/main.tpa~
END
```

Browse the code to see the available constants, use [BGforge MLS](https://github.com/BGforgeNet/VScode-BGforge-MLS) to get tips (completion and stuff).

### 3. Update

```bash
git submodule update --remote
git add lib/bgforge
git commit -m "updated BGforge IElib"
```
