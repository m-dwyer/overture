import { expect, type Page } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";
import { annotate, capture } from "./annotate";
import { makeDriver } from "./driver";
import { writeGuide } from "./emit-markdown";
import { writeGuideHtml } from "./emit-html";
import { ASSET_DIR } from "./paths";
import type { GuideConfig, Scene, Section, Shot } from "./types";

// Shared generator used by both manual specs: boot the emulator once per scene,
// run each shot's real-gesture drive(), annotate, capture, then emit markdown +
// HTML from `cfg`. The beginner guide and the full reference differ only in their
// scenes + cfg — never in this loop.
//
// We deliberately do NOT wipe OUT_DIR/ASSET_DIR: the two guides share
// docs/generated/assets and use disjoint filename prefixes, so a wholesale clean
// would delete the other guide's figures. Each run just overwrites its own files.
export async function generateGuide(page: Page, scenes: Scene[], cfg: GuideConfig): Promise<void> {
  mkdirSync(ASSET_DIR, { recursive: true });

  const d = makeDriver(page);
  const sections: Section[] = [];

  for (const scene of scenes) {
    await d.boot();
    if (scene.setup) await scene.setup(d);
    const shots: Shot[] = [];
    for (const shot of scene.shots) {
      if (shot.drive) await shot.drive(d);
      await annotate(page, shot.action, shot.showing, shot.targets ?? []);
      await capture(page, shot.file, shot.crop ?? "panel");
      shots.push({ title: shot.title, file: shot.file, caption: shot.caption });
    }
    sections.push({ title: scene.title, body: scene.body, shots });
  }

  writeGuide(sections, scenes, cfg);
  writeGuideHtml(sections, scenes, cfg);
  expect(existsSync(cfg.mdPath)).toBe(true);
  expect(existsSync(cfg.htmlPath)).toBe(true);
}
