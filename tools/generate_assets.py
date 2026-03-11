from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = ROOT / "client" / "assets"
GENERATED_ROOT = ASSET_ROOT / "generated"

CLASS_THEMES = {
    "warrior": {
        "name": "Warrior",
        "armor": "#7f4b36",
        "trim": "#e9cf8b",
        "cloth": "#7f2232",
        "weapon": "#d9e1ea",
        "glow": "#ffbb63",
    },
    "mage": {
        "name": "Mage",
        "armor": "#34507f",
        "trim": "#a9d9ff",
        "cloth": "#653c9d",
        "weapon": "#dcecff",
        "glow": "#7ed8ff",
    },
    "ranger": {
        "name": "Ranger",
        "armor": "#3e6a3f",
        "trim": "#d5df8d",
        "cloth": "#6e4f27",
        "weapon": "#d6d3c8",
        "glow": "#8ee77f",
    },
    "cleric": {
        "name": "Cleric",
        "armor": "#f0e0b4",
        "trim": "#fff8d9",
        "cloth": "#9a9fc6",
        "weapon": "#f7f7ff",
        "glow": "#ffe48a",
    },
}

POSES = {
    "idle": [
        {"weapon_dx": 0, "weapon_dy": 0, "cape": 0, "aura": 0.18, "tilt": 0},
        {"weapon_dx": 2, "weapon_dy": -2, "cape": 3, "aura": 0.24, "tilt": -2},
    ],
    "walk": [
        {"weapon_dx": -4, "weapon_dy": 1, "cape": -6, "aura": 0.16, "tilt": -4},
        {"weapon_dx": 4, "weapon_dy": 0, "cape": 7, "aura": 0.12, "tilt": 4},
    ],
    "attack": [
        {"weapon_dx": 12, "weapon_dy": -16, "cape": -9, "aura": 0.36, "tilt": 10},
        {"weapon_dx": 18, "weapon_dy": -24, "cape": 4, "aura": 0.46, "tilt": 18},
    ],
}

ENEMY_POSES = {
    "idle": [(0, 0, 0.14), (0, -2, 0.18)],
    "walk": [(-4, 1, 0.2), (4, -1, 0.22)],
    "attack": [(0, -10, 0.28), (0, -16, 0.36)],
}

ENEMY_THEMES = {
    "slime": {
        "idle": ("#64d0a2", "#d6fff2"),
        "walk": ("#5cc3f5", "#def6ff"),
        "attack": ("#ff7b74", "#ffe7c8"),
    },
    "mossling": {
        "idle": ("#6fbf6f", "#f1ffd6"),
        "walk": ("#9ad074", "#f6ffd8"),
        "attack": ("#d19758", "#fff0c7"),
    },
}


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def write_svg(relative_path: str, content: str) -> None:
    target = GENERATED_ROOT / relative_path
    ensure_dir(target.parent)
    target.write_text(content.strip() + "\n", encoding="utf-8")


def svg_document(width: int, height: int, body: str, background: str = "") -> str:
    return f"""
<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" fill="none">
  <defs>
    <linearGradient id="goldTrim" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f9e4aa"/>
      <stop offset="100%" stop-color="#b88739"/>
    </linearGradient>
    <linearGradient id="shadowFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0"/>
    </linearGradient>
    <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  {background}
  {body}
</svg>
"""


def create_character_svg(class_key: str, state: str, frame_index: int, theme: dict[str, str], pose: dict[str, float]) -> str:
    aura_opacity = pose["aura"]
    weapon_dx = pose["weapon_dx"]
    weapon_dy = pose["weapon_dy"]
    cape_offset = pose["cape"]
    tilt = pose["tilt"]

    body = f"""
  <ellipse cx="64" cy="118" rx="22" ry="10" fill="#000" fill-opacity="0.28"/>
  <g transform="rotate({tilt} 64 70)">
    <ellipse cx="64" cy="44" rx="26" ry="28" fill="{theme['glow']}" fill-opacity="{aura_opacity}" filter="url(#softGlow)"/>
    <path d="M48 108 C38 84, 36 56, 52 38 C61 26, 83 24, 92 37 C109 57, 106 85, 95 109 Z" fill="{theme['cloth']}" opacity="0.92"/>
    <path d="M45 {108 + cape_offset} C32 88, 34 54, 50 39 C64 26, 87 29, 99 41 C111 57, 108 91, 88 {112 + cape_offset} Z" fill="#1f1824" opacity="0.56"/>
    <path d="M40 73 C42 49, 52 34, 64 34 C76 34, 86 49, 88 73 L84 103 C79 109, 71 112, 64 112 C57 112, 49 109, 44 103 Z" fill="{theme['armor']}" stroke="url(#goldTrim)" stroke-width="3"/>
    <path d="M48 71 C52 58, 57 50, 64 50 C71 50, 76 58, 80 71" stroke="{theme['trim']}" stroke-width="4" stroke-linecap="round"/>
    <rect x="54" y="70" width="20" height="16" rx="7" fill="{theme['trim']}" opacity="0.82"/>
    <ellipse cx="64" cy="31" rx="13" ry="14" fill="#f2d2b7"/>
    <path d="M52 27 C55 14, 73 12, 77 26 C71 19, 57 19, 52 27 Z" fill="#34231f"/>
    <circle cx="60" cy="31" r="1.8" fill="#2d201b"/>
    <circle cx="68" cy="31" r="1.8" fill="#2d201b"/>
    <path d="M60 38 C63 40, 66 40, 69 38" stroke="#9b5e58" stroke-width="2" stroke-linecap="round"/>
    <path d="M50 59 L38 84" stroke="{theme['armor']}" stroke-width="8" stroke-linecap="round"/>
    <path d="M78 58 L94 84" stroke="{theme['armor']}" stroke-width="8" stroke-linecap="round"/>
    <path d="M56 105 L48 124" stroke="{theme['armor']}" stroke-width="9" stroke-linecap="round"/>
    <path d="M72 105 L80 124" stroke="{theme['armor']}" stroke-width="9" stroke-linecap="round"/>
    <path d="M92 {72 + weapon_dy} L{106 + weapon_dx} {46 + weapon_dy} L{114 + weapon_dx} {50 + weapon_dy} L{99 + weapon_dx} {78 + weapon_dy}" stroke="{theme['weapon']}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="{98 + weapon_dx}" cy="{78 + weapon_dy}" r="5" fill="{theme['glow']}" fill-opacity="0.55"/>
  </g>
"""
    return svg_document(128, 128, body)


def create_enemy_svg(enemy_type: str, state: str, frame_index: int, drift_x: int, drift_y: int, aura_opacity: float) -> str:
    hue = ENEMY_THEMES[enemy_type][state]
    body = f"""
  <ellipse cx="64" cy="108" rx="24" ry="12" fill="#000" fill-opacity="0.28"/>
  <ellipse cx="64" cy="72" rx="28" ry="24" fill="{hue[0]}" fill-opacity="{aura_opacity}" filter="url(#softGlow)"/>
  <path d="M32 {82 + drift_y} C34 40, 53 24, 64 24 C81 24, 95 41, 96 63 C98 90, 85 108, 64 108 C45 108, 30 95, 32 {82 + drift_y} Z" fill="{hue[0]}" stroke="{hue[1]}" stroke-width="4"/>
  <path d="M44 50 C48 40, 59 35, 69 35 C79 35, 87 42, 90 52" stroke="#ffffff" stroke-opacity="0.56" stroke-width="5" stroke-linecap="round"/>
  <circle cx="54" cy="66" r="5" fill="#1f2a2b"/>
  <circle cx="74" cy="66" r="5" fill="#1f2a2b"/>
  <path d="M52 82 C58 88, 70 88, 76 82" stroke="#1f2a2b" stroke-width="4" stroke-linecap="round"/>
  <circle cx="{46 + drift_x}" cy="96" r="4" fill="{hue[1]}" fill-opacity="0.9"/>
  <circle cx="{82 - drift_x}" cy="96" r="4" fill="{hue[1]}" fill-opacity="0.9"/>
    {'' if enemy_type == 'slime' else '<path d="M48 34 L42 18 L56 24 L64 12 L72 24 L86 18 L80 34" fill="#d5b66d" stroke="#fff2c8" stroke-width="3" stroke-linejoin="round"/>'}
"""
    return svg_document(128, 128, body)


def create_tile_svg(kind: str) -> str:
    if kind == "grass":
        body = """
  <rect width="64" height="64" rx="14" fill="#355737"/>
  <path d="M0 46 C14 34, 25 38, 36 34 C49 29, 58 36, 64 24 V64 H0 Z" fill="#456b43"/>
  <path d="M10 56 L18 40 L21 56 M28 58 L35 42 L40 57 M43 54 L49 38 L54 54" stroke="#87b56b" stroke-width="2.2" stroke-linecap="round"/>
  <circle cx="18" cy="20" r="3" fill="#b8df7c" opacity="0.7"/>
  <circle cx="40" cy="14" r="2" fill="#d9f5b5" opacity="0.6"/>
"""
    elif kind == "path":
        body = """
  <rect width="64" height="64" rx="14" fill="#5e4b38"/>
  <path d="M0 52 C18 34, 26 43, 38 36 C50 30, 64 38, 64 38 V64 H0 Z" fill="#7d6548"/>
  <path d="M8 24 L18 20 L24 28 L14 34 Z M30 16 L42 14 L47 22 L35 26 Z M42 40 L56 38 L58 48 L46 50 Z" fill="#9d835f" opacity="0.75"/>
"""
    elif kind == "platform":
        body = """
  <rect width="64" height="64" rx="14" fill="#31414b"/>
  <path d="M4 16 H60 V48 H4 Z" fill="#5a6f79" stroke="#9bc2cb" stroke-width="3"/>
  <path d="M10 22 H54 M10 32 H54 M10 42 H54" stroke="#d4ebef" stroke-opacity="0.35" stroke-width="2"/>
"""
    else:
        raise ValueError(f"Unknown tile kind: {kind}")
    return svg_document(64, 64, body)


def create_prop_svg(kind: str) -> str:
    if kind == "tree":
        body = """
  <ellipse cx="64" cy="120" rx="28" ry="10" fill="#000" fill-opacity="0.22"/>
  <rect x="55" y="74" width="18" height="42" rx="8" fill="#664327"/>
  <circle cx="64" cy="58" r="28" fill="#2d6b40"/>
  <circle cx="44" cy="68" r="19" fill="#3f8d54"/>
  <circle cx="82" cy="68" r="18" fill="#4d9d63"/>
  <circle cx="64" cy="40" r="18" fill="#5fb978"/>
"""
    elif kind == "crystal":
        body = """
  <ellipse cx="64" cy="118" rx="24" ry="8" fill="#000" fill-opacity="0.24"/>
  <path d="M63 20 L84 48 L72 108 L54 108 L42 48 Z" fill="#74d6ff" stroke="#ebfbff" stroke-width="4"/>
  <path d="M63 20 L63 108 M42 48 L84 48" stroke="#ffffff" stroke-opacity="0.56" stroke-width="3"/>
  <circle cx="64" cy="64" r="28" fill="#74d6ff" fill-opacity="0.18" filter="url(#softGlow)"/>
"""
    elif kind == "brazier":
        body = """
  <ellipse cx="64" cy="120" rx="20" ry="8" fill="#000" fill-opacity="0.24"/>
  <path d="M44 96 H84 L76 112 H52 Z" fill="#6f726d" stroke="#d6cda8" stroke-width="3"/>
  <path d="M52 96 L48 78 H80 L76 96" fill="#3e4f4d"/>
  <path d="M62 80 C54 70, 58 58, 66 48 C74 62, 76 73, 68 84 C66 78, 64 75, 62 80 Z" fill="#ffb349"/>
  <path d="M61 74 C57 67, 60 58, 66 52 C72 60, 70 68, 66 76 C65 72, 63 70, 61 74 Z" fill="#ffe08a"/>
"""
    elif kind == "mushroom-ring":
        body = """
  <ellipse cx="64" cy="120" rx="24" ry="8" fill="#000" fill-opacity="0.24"/>
  <circle cx="42" cy="88" r="10" fill="#d3a65e"/>
  <path d="M36 90 C38 80, 46 76, 52 82" stroke="#fff2d3" stroke-width="3" stroke-linecap="round"/>
  <rect x="40" y="90" width="5" height="18" rx="2.5" fill="#f0e7cd"/>
  <circle cx="66" cy="78" r="12" fill="#d18c49"/>
  <path d="M58 80 C60 68, 70 66, 77 72" stroke="#fff0d0" stroke-width="3" stroke-linecap="round"/>
  <rect x="63" y="80" width="6" height="24" rx="3" fill="#efe6ca"/>
  <circle cx="86" cy="94" r="9" fill="#b86f3c"/>
  <path d="M80 96 C82 87, 89 84, 95 89" stroke="#ffe5c0" stroke-width="3" stroke-linecap="round"/>
  <rect x="84" y="95" width="5" height="16" rx="2.5" fill="#efe6ca"/>
  <circle cx="60" cy="100" r="8" fill="#cf8543"/>
  <rect x="58" y="100" width="4" height="12" rx="2" fill="#f1e6cf"/>
"""
    elif kind == "obelisk":
        body = """
  <ellipse cx="64" cy="118" rx="24" ry="8" fill="#000" fill-opacity="0.24"/>
  <path d="M64 18 L86 54 L74 108 H54 L42 54 Z" fill="#44555e" stroke="#dce7ef" stroke-width="4"/>
  <path d="M64 18 L64 108" stroke="#a8d3ff" stroke-opacity="0.6" stroke-width="3"/>
  <path d="M50 64 H78" stroke="#c8dbeb" stroke-opacity="0.4" stroke-width="3"/>
  <circle cx="64" cy="62" r="24" fill="#74d6ff" fill-opacity="0.12" filter="url(#softGlow)"/>
"""
    else:
        raise ValueError(f"Unknown prop kind: {kind}")
    return svg_document(128, 128, body)


def create_ui_frame(kind: str) -> str:
    if kind == "window":
        body = """
  <rect x="6" y="6" width="500" height="324" rx="26" fill="#0d1718"/>
  <rect x="10" y="10" width="492" height="316" rx="24" fill="#182624" stroke="url(#goldTrim)" stroke-width="4"/>
  <rect x="26" y="26" width="460" height="52" rx="16" fill="#27322d" stroke="#5a735f" stroke-width="2"/>
  <path d="M38 50 H180 M332 50 H474" stroke="#e2c47c" stroke-opacity="0.55" stroke-width="2.5"/>
  <circle cx="26" cy="26" r="7" fill="#e6c980"/>
  <circle cx="486" cy="26" r="7" fill="#e6c980"/>
  <circle cx="26" cy="306" r="7" fill="#e6c980"/>
  <circle cx="486" cy="306" r="7" fill="#e6c980"/>
"""
        return svg_document(512, 336, body)

    if kind == "slot":
        body = """
  <rect x="4" y="4" width="88" height="88" rx="18" fill="#111a1a" stroke="url(#goldTrim)" stroke-width="4"/>
  <rect x="12" y="12" width="72" height="72" rx="14" fill="#22312e" stroke="#4d6156" stroke-width="2"/>
  <path d="M20 24 H76 M20 72 H76" stroke="#d9c38e" stroke-opacity="0.22" stroke-width="2"/>
"""
        return svg_document(96, 96, body)

    if kind == "button":
        body = """
  <rect x="4" y="4" width="184" height="56" rx="18" fill="#4d3b1e" stroke="url(#goldTrim)" stroke-width="4"/>
  <rect x="10" y="10" width="172" height="44" rx="14" fill="#c19a55"/>
  <path d="M24 22 H166" stroke="#f9e7bc" stroke-opacity="0.55" stroke-width="3"/>
"""
        return svg_document(192, 64, body)

    if kind == "feed":
        body = """
  <rect x="4" y="4" width="472" height="132" rx="24" fill="#0f1818" stroke="url(#goldTrim)" stroke-width="4"/>
  <rect x="14" y="14" width="452" height="112" rx="18" fill="#182321"/>
  <path d="M24 36 H454" stroke="#e6c987" stroke-opacity="0.25" stroke-width="2"/>
"""
        return svg_document(480, 140, body)

    raise ValueError(f"Unknown UI frame: {kind}")


def create_ui_icon(kind: str) -> str:
    shapes = {
        "inventory": '<path d="M20 28 H76 L72 84 H24 Z" fill="#c79f57" stroke="#f5e1ad" stroke-width="4"/><path d="M32 30 C32 18, 44 10, 48 10 C52 10, 64 18, 64 30" stroke="#f5e1ad" stroke-width="4" stroke-linecap="round"/>',
        "guild": '<path d="M20 22 H76 V76 L48 62 L20 76 Z" fill="#6d79b3" stroke="#eef1ff" stroke-width="4"/><path d="M32 34 H64 M32 46 H58" stroke="#eef1ff" stroke-width="4" stroke-linecap="round"/>',
        "trader": '<circle cx="34" cy="34" r="14" fill="#ffcf78" stroke="#fff2c9" stroke-width="4"/><path d="M28 34 H40 M34 28 V40" stroke="#77511e" stroke-width="4" stroke-linecap="round"/><path d="M22 60 H76" stroke="#e7d7a4" stroke-width="4"/><path d="M28 50 H70 L64 80 H34 Z" fill="#7d5a35" stroke="#e7d7a4" stroke-width="4"/>',
        "party": '<circle cx="30" cy="30" r="12" fill="#8fd8ff"/><circle cx="64" cy="30" r="12" fill="#d0f3ff"/><path d="M14 76 C16 58, 25 50, 40 50 C55 50, 64 58, 66 76" fill="#4a7f89"/><path d="M48 76 C50 58, 59 50, 74 50 C89 50, 98 58, 100 76" fill="#739ea8" transform="translate(-10 0)"/>',
        "combat": '<path d="M56 14 L78 30 L66 36 L82 72 L68 78 L52 42 L40 52 Z" fill="#d2dde9" stroke="#fff7df" stroke-width="4"/><path d="M20 72 C34 52, 48 52, 62 72" stroke="#ff9c63" stroke-width="6" stroke-linecap="round"/>',
    }
    body = shapes[kind]
    return svg_document(96, 96, body)


def main() -> None:
    ensure_dir(GENERATED_ROOT)

    for class_key, theme in CLASS_THEMES.items():
        for state, variants in POSES.items():
            for index, pose in enumerate(variants):
                write_svg(
                    f"sprites/classes/{class_key}/{state}-{index}.svg",
                    create_character_svg(class_key, state, index, theme, pose),
                )

    for enemy_type in ENEMY_THEMES:
        for state, variants in ENEMY_POSES.items():
            for index, (drift_x, drift_y, aura_opacity) in enumerate(variants):
                write_svg(
                    f"sprites/enemies/{enemy_type}/{state}-{index}.svg",
                    create_enemy_svg(enemy_type, state, index, drift_x, drift_y, aura_opacity),
                )

    for tile_kind in ("grass", "path", "platform"):
        write_svg(f"environment/tiles/{tile_kind}.svg", create_tile_svg(tile_kind))

    for prop_kind in ("tree", "crystal", "brazier", "mushroom-ring", "obelisk"):
        write_svg(f"environment/props/{prop_kind}.svg", create_prop_svg(prop_kind))

    for frame_kind in ("window", "slot", "button", "feed"):
        write_svg(f"ui/frames/{frame_kind}.svg", create_ui_frame(frame_kind))

    for icon_kind in ("inventory", "guild", "trader", "party", "combat"):
        write_svg(f"ui/icons/{icon_kind}.svg", create_ui_icon(icon_kind))

    print(f"Generated assets under {GENERATED_ROOT}")


if __name__ == "__main__":
    main()