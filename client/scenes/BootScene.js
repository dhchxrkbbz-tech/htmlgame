import Phaser from "phaser";
import { loadAssetManifest } from "../assets/assetManifest.js";
import { auditLoadedAssets, validateAssetManifest } from "../assets/assetAudit.js";
import { buildGeneratedTextures } from "../systems/player/playerTextures.js";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    const manifestIssues = validateAssetManifest();
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x08110e).setOrigin(0);
    this.add.text(48, 56, "HTMLGame Demo Boot", {
      color: "#f6f2df",
      fontSize: "30px",
      fontStyle: "bold",
    });
    this.add.text(48, 98, "Loading assets and preparing the local demo flow.", {
      color: "#b7d2c2",
      fontSize: "16px",
    });

    loadAssetManifest(this);

    const progressBarBg = this.add.rectangle(48, 146, 340, 18, 0x20372c, 1).setOrigin(0, 0.5);
    const progressBarFill = this.add.rectangle(48, 146, 4, 18, 0xd7c46e, 1).setOrigin(0, 0.5);
    const progress = this.add.text(48, 176, "Loading 0%", {
      color: "#f6f2df",
      fontSize: "18px",
    });

    this.load.on("progress", (value) => {
      progress.setText(`Loading ${Math.round(value * 100)}%`);
      progressBarFill.width = 340 * value;
    });

    this.load.on("complete", () => {
      const audit = auditLoadedAssets(this);
      const issueCount = manifestIssues.length + audit.missing.length;
      progress.setText(issueCount ? `Loading complete with ${issueCount} audit issue(s)` : "Loading complete");
      progressBarBg.setFillStyle(0x2b493c, 1);

      [...manifestIssues, ...audit.missing.map((entry) => `Missing asset: ${entry}`)].forEach((issue) => {
        console.warn(`[asset-audit] ${issue}`);
      });
    });
  }

  create() {
    buildGeneratedTextures(this);
    this.cameras.main.fadeOut(180, 8, 17, 14);
    this.time.delayedCall(190, () => {
      this.scene.start("LoginScene");
    });
  }
}