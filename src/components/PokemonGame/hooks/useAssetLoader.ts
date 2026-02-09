'use client';
import { useState, useEffect } from 'react';
import { GameAssets } from '../types';
import { BUILDINGS, INTERIOR_CONFIGS } from '../constants';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function useAssetLoader() {
  const [assets, setAssets] = useState<GameAssets>({
    player: null,
    grass: null,
    tallGrass: null,
    tree1: null,
    tree2: null,
    buildingSprites: {},
    interiorBackgrounds: {},
    back: null,
    chen: null,
    pokemonBattle: null,
    title: null,
  });
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      const result: GameAssets = {
        player: null,
        grass: null,
        tallGrass: null,
        tree1: null,
        tree2: null,
        buildingSprites: {},
        interiorBackgrounds: {},
        back: null,
        chen: null,
        pokemonBattle: null,
        title: null,
      };

      // Core assets to load
      const coreAssets: [string, string][] = [
        ['player', '/pokemon/player/player-sprite.png'],
        ['grass', '/pokemon/grass/grass.png'],
        ['tallGrass', '/pokemon/grass/grass-pokemon.png'],
        ['tree1', '/pokemon/trees/1.png'],
        ['tree2', '/pokemon/trees/2.png'],
      ];

      // Collect unique building sprite paths
      const buildingSpriteFiles = new Set<string>();
      for (const b of BUILDINGS) {
        buildingSpriteFiles.add(b.spriteFile);
      }

      // Collect interior asset paths (backgrounds + NPC sprites)
      const interiorAssetPaths = new Set<string>();
      for (const config of Object.values(INTERIOR_CONFIGS)) {
        interiorAssetPaths.add(config.backgroundImage);
        if (config.npcSprite) {
          interiorAssetPaths.add(config.npcSprite);
        }
      }

      const totalItems = coreAssets.length + buildingSpriteFiles.size + interiorAssetPaths.size;
      let loadedCount = 0;

      // Load core assets
      for (const [key, path] of coreAssets) {
        try {
          const img = await loadImage(path);
          if (cancelled) return;
          (result as any)[key] = img;
        } catch (err) {
          console.warn(`Failed to load asset: ${key}`, err);
        }
        loadedCount++;
        setProgress(Math.round((loadedCount / totalItems) * 100));
      }

      // Load building sprites
      for (const spriteFile of buildingSpriteFiles) {
        try {
          const img = await loadImage(spriteFile);
          if (cancelled) return;
          result.buildingSprites[spriteFile] = img;
        } catch (err) {
          console.warn(`Failed to load building sprite: ${spriteFile}`, err);
        }
        loadedCount++;
        setProgress(Math.round((loadedCount / totalItems) * 100));
      }

      // Load interior assets (backgrounds + NPC sprites)
      for (const assetPath of interiorAssetPaths) {
        try {
          const img = await loadImage(assetPath);
          if (cancelled) return;
          result.interiorBackgrounds[assetPath] = img;
        } catch (err) {
          console.warn(`Failed to load interior asset: ${assetPath}`, err);
        }
        loadedCount++;
        setProgress(Math.round((loadedCount / totalItems) * 100));
      }

      if (!cancelled) {
        setAssets(result);
        setLoaded(true);
      }
    }

    loadAll();
    return () => { cancelled = true; };
  }, []);

  return { assets, loaded, progress };
}
