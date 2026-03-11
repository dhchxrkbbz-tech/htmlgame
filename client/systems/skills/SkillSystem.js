export class SkillSystem {
  constructor(scene, classKey, definitions) {
    this.scene = scene;
    this.classKey = classKey;
    this.classDefinition = definitions[classKey] ?? definitions.warrior;
  }

  getBasicAttack() {
    return this.classDefinition.basicAttack;
  }

  getSkill(index) {
    return this.classDefinition.skills[index] ?? null;
  }

  getQuickbar() {
    return this.classDefinition.skills;
  }
}