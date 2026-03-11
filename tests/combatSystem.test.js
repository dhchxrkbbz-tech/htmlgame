import { describe, expect, it } from "vitest";
import { calculateDamage, getSkillTargetPoint, hitTestCircle, sortTargetsByDistance } from "../client/systems/combat/combatMath.js";

describe("CombatSystem helpers", () => {
  it("calculates skill damage with defense reduction", () => {
    const damage = calculateDamage(
      { power: 20 },
      { defense: 8 },
      { power: 1.5 },
    );

    expect(damage).toBe(26);
  });

  it("filters targets inside the hit radius", () => {
    const targets = [
      { active: true, x: 10, y: 10 },
      { active: true, x: 120, y: 120 },
      { active: false, x: 20, y: 20 },
    ];

    const hits = hitTestCircle({ x: 0, y: 0 }, targets, 30);
    expect(hits).toHaveLength(1);
  });

  it("projects ranged skills forward based on facing", () => {
    const point = getSkillTargetPoint({ x: 100, y: 200 }, "right", {
      radius: 40,
      range: 180,
    });

    expect(point).toEqual({ x: 262, y: 200 });
  });

  it("sorts targets by distance from the impact point", () => {
    const sorted = sortTargetsByDistance({ x: 0, y: 0 }, [
      { x: 30, y: 30 },
      { x: 10, y: 10 },
      { x: 20, y: 20 },
    ]);

    expect(sorted.map((target) => target.x)).toEqual([10, 20, 30]);
  });
});