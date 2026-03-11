import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene.js";
import { LoginScene } from "./scenes/LoginScene.js";
import { GameScene } from "./scenes/GameScene.js";

export function createGameConfig(parent) {
  return {
    type: Phaser.AUTO,
    parent,
    width: 1280,
    height: 720,
    backgroundColor: "#08110e",
    pixelArt: true,
    dom: {
      createContainer: true,
    },
    physics: {
      default: "arcade",
      arcade: {
        gravity: { y: 0 },
        debug: false,
      },
    },
    scene: [BootScene, LoginScene, GameScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  };
}