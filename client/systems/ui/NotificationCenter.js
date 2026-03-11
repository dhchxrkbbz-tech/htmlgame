export class NotificationCenter {
  constructor(scene) {
    this.scene = scene;
    this.entries = [];
    this.container = scene.add.container(scene.scale.width / 2, 54).setScrollFactor(0).setDepth(1500);
  }

  push({ title, body = "", tint = 0xd7c46e, lifetime = 2600 }) {
    const width = 328;
    const background = this.scene.add.rectangle(0, 0, width, body ? 56 : 40, 0x08110e, 0.92).setOrigin(0.5, 0);
    background.setStrokeStyle(1, tint, 0.8);
    const accent = this.scene.add.rectangle(-(width / 2) + 2, 2, 4, body ? 52 : 36, tint, 1).setOrigin(0, 0);
    const titleText = this.scene.add.text(-(width / 2) + 18, 10, title, {
      fontSize: "15px",
      color: "#f6f2df",
      fontStyle: "bold",
      wordWrap: { width: width - 32 },
    }).setOrigin(0, 0);
    const bodyText = this.scene.add.text(-(width / 2) + 18, 30, body, {
      fontSize: "11px",
      color: "#cbd8ce",
      wordWrap: { width: width - 32 },
    }).setOrigin(0, 0).setVisible(Boolean(body));

    const entry = this.scene.add.container(0, 0, [background, accent, titleText, bodyText]);
    entry.setAlpha(0);
    this.container.add(entry);
    this.entries.unshift(entry);
    this.relayout();

    this.scene.tweens.add({
      targets: entry,
      alpha: 1,
      y: entry.y + 8,
      duration: 180,
      ease: "Cubic.easeOut",
    });

    this.scene.time.delayedCall(lifetime, () => {
      this.scene.tweens.add({
        targets: entry,
        alpha: 0,
        y: entry.y - 10,
        duration: 220,
        onComplete: () => {
          this.entries = this.entries.filter((candidate) => candidate !== entry);
          entry.destroy(true);
          this.relayout();
        },
      });
    });
  }

  relayout() {
    this.entries.forEach((entry, index) => {
      const targetY = index * 64;
      this.scene.tweens.add({
        targets: entry,
        y: targetY,
        duration: 140,
        ease: "Cubic.easeOut",
      });
    });
  }

  destroy() {
    this.container?.destroy(true);
  }
}