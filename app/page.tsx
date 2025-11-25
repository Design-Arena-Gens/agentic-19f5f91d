"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

type EnhancedImage = {
  id: string;
  name: string;
  originalUrl: string;
  enhancedUrl: string;
  enhancedBlob: Blob;
  width: number;
  height: number;
  scale: number;
  clothing: string[];
  script: string;
  videoUrl?: string;
  videoBlob?: Blob;
};

type ProcessingOptions = {
  scale: number;
  brightness: number;
  saturation: number;
  sharpen: number;
};

const clothingKeywords = [
  "shirt",
  "t-shirt",
  "tee",
  "top",
  "blouse",
  "dress",
  "gown",
  "skirt",
  "jacket",
  "coat",
  "trench",
  "jean",
  "denim",
  "pant",
  "trouser",
  "short",
  "sweater",
  "hoodie",
  "cardigan",
  "vest",
  "suit",
  "blazer",
  "scarf",
  "hat",
  "cap",
  "beanie",
  "bag",
  "handbag",
  "purse",
  "backpack",
  "belt",
  "shoe",
  "sneaker",
  "boot",
  "heel",
  "loafer",
  "sandal",
  "watch",
  "bracelet",
  "ring",
  "necklace",
  "earring",
  "sunglass",
  "glasses"
];

const cocoClothingLabels = new Set([
  "person",
  "backpack",
  "umbrella",
  "handbag",
  "tie",
  "suitcase"
]);

const defaultOptions: ProcessingOptions = {
  scale: 2,
  brightness: 1.08,
  saturation: 1.12,
  sharpen: 0.25
};

export default function HomePage() {
  const [enhanced, setEnhanced] = useState<EnhancedImage[]>([]);
  const [processing, setProcessing] = useState(false);
  const [videoBusy, setVideoBusy] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [vibe, setVibe] = useState("casual");
  const [options, setOptions] = useState<ProcessingOptions>(defaultOptions);
  const [modelReady, setModelReady] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const cocoModelRef = useRef<any>(null);
  const mobilenetRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadModels = async () => {
      try {
        const tf = await import("@tensorflow/tfjs");
        tf.setBackend("webgl");
        await tf.ready();
        const [cocoModule, mobilenetModule] = await Promise.all([
          import("@tensorflow-models/coco-ssd"),
          import("@tensorflow-models/mobilenet")
        ]);
        if (!cancelled) {
          cocoModelRef.current = await cocoModule.load();
          mobilenetRef.current = await mobilenetModule.load();
          setModelReady(true);
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setModelError(
            "Impossible de charger les modèles de détection. Rechargez la page ou vérifiez votre connexion."
          );
        }
      }
    };
    loadModels();
    return () => {
      cancelled = true;
    };
  }, []);

  const processFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) {
        return;
      }
      setProcessing(true);
      try {
        const results: EnhancedImage[] = [];
        for (const file of files) {
          const originalUrl = URL.createObjectURL(file);
          const enhancedResult = await enhanceOne(file, options);
          const clothing = modelReady
            ? await detectClothing(enhancedResult.canvas, cocoModelRef.current, mobilenetRef.current)
            : [];
          const script = buildScript(clothing, brandName.trim(), vibe);
          results.push({
            id: `${file.name}-${Date.now()}`,
            name: file.name,
            originalUrl,
            enhancedUrl: enhancedResult.url,
            enhancedBlob: enhancedResult.blob,
            width: enhancedResult.canvas.width,
            height: enhancedResult.canvas.height,
            scale: options.scale,
            clothing,
            script
          });
        }
        setEnhanced((prev) => [...results, ...prev]);
      } catch (error) {
        console.error(error);
      } finally {
        setProcessing(false);
      }
    },
    [options, brandName, vibe, modelReady]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const files = Array.from(event.dataTransfer.files).filter((file) =>
        file.type.startsWith("image/")
      );
      if (files.length) {
        void processFiles(files);
      }
    },
    [processFiles]
  );

  const handleFileInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []).filter((file) =>
        file.type.startsWith("image/")
      );
      if (files.length) {
        void processFiles(files);
      }
    },
    [processFiles]
  );

  const onGenerateVideo = useCallback(
    async (item: EnhancedImage) => {
      setVideoBusy(true);
      try {
        const result = await createVideoFromImage(
          item,
          vibe,
          brandName.trim(),
          item.script
        );
        setEnhanced((prev) =>
          prev.map((entry) =>
            entry.id === item.id
              ? { ...entry, videoUrl: result.videoUrl, videoBlob: result.videoBlob }
              : entry
          )
        );
      } catch (error) {
        console.error(error);
      } finally {
        setVideoBusy(false);
      }
    },
    [vibe, brandName]
  );

  const clothingSummary = useMemo(() => {
    if (!enhanced.length) return [];
    return enhanced.map((item) => ({
      id: item.id,
      name: item.name,
      clothing: item.clothing,
      script: item.script
    }));
  }, [enhanced]);

  return (
    <main className="min-h-screen px-6 pb-16 pt-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-24">
        <header className="flex flex-col gap-4 rounded-3xl bg-white/80 p-10 shadow-lg">
          <h1 className="text-3xl font-semibold">
            Studio UGC Mode — traitement d’images & vidéo express
          </h1>
          <p className="max-w-3xl text-lg text-neutral-600">
            Optimisez vos visuels mode, détectez les pièces clés et générez une vidéo courte au format
            TikTok/Instagram Reels tout en respectant l’identité originale.
          </p>
          <div className="flex flex-wrap gap-4">
            <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
              Nom de marque (optionnel)
              <input
                value={brandName}
                onChange={(event) => setBrandName(event.target.value)}
                placeholder="Ex : Atelier Soleil"
                className="w-60 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-base outline-none transition focus:border-black"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
              Vibe UGC
              <select
                value={vibe}
                onChange={(event) => setVibe(event.target.value)}
                className="w-48 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-base outline-none transition focus:border-black"
              >
                <option value="casual">Casual chic</option>
                <option value="minimal">Minimaliste</option>
                <option value="luxury">Luxury / premium</option>
                <option value="street">Streetwear</option>
                <option value="romantic">Romantique</option>
              </select>
            </label>
            <div className="flex flex-1 items-end justify-end gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full bg-black px-6 py-3 text-white transition hover:bg-neutral-800"
              >
                Importer des images
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileInput}
                className="hidden"
              />
            </div>
          </div>
          <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <ControlCard
              title="Facteur d’upscale"
              description="Augmente la résolution sans déformation."
            >
              <div className="flex gap-3">
                {[2, 3, 4].map((value) => (
                  <button
                    key={value}
                    onClick={() => setOptions((prev) => ({ ...prev, scale: value }))}
                    className={clsx(
                      "rounded-xl border px-4 py-2 text-sm transition",
                      options.scale === value
                        ? "border-black bg-black text-white"
                        : "border-neutral-300 bg-white text-neutral-700 hover:border-black"
                    )}
                  >
                    ×{value}
                  </button>
                ))}
              </div>
            </ControlCard>
            <ControlCard
              title="Luminosité"
              description="Adoucie les contrastes pour une peau plus lumineuse."
            >
              <Slider
                min={0.8}
                max={1.2}
                step={0.01}
                value={options.brightness}
                onChange={(value) =>
                  setOptions((prev) => ({ ...prev, brightness: value }))
                }
              />
            </ControlCard>
            <ControlCard
              title="Couleurs naturelles"
              description="Réhausse légèrement la saturation en préservant le rendu."
            >
              <Slider
                min={0.9}
                max={1.3}
                step={0.01}
                value={options.saturation}
                onChange={(value) =>
                  setOptions((prev) => ({ ...prev, saturation: value }))
                }
              />
            </ControlCard>
            <ControlCard
              title="Netteté"
              description="Restaure les micro-détails (coutures, textures)."
            >
              <Slider
                min={0}
                max={0.5}
                step={0.01}
                value={options.sharpen}
                onChange={(value) =>
                  setOptions((prev) => ({ ...prev, sharpen: value }))
                }
              />
            </ControlCard>
          </section>
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            className="mt-4 flex min-h-[220px] flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-neutral-300 bg-neutral-50 px-6 py-10 text-center text-neutral-500 transition hover:border-neutral-600"
          >
            <p className="text-lg font-medium">
              Glissez-déposez vos visuels (JPG, PNG, WebP)
            </p>
            <p className="max-w-lg text-sm text-neutral-400">
              Le traitement se fait côté navigateur : vos images ne quittent jamais votre appareil.
            </p>
            {processing && (
              <span className="rounded-full bg-black px-4 py-2 text-sm text-white">
                Optimisation en cours…
              </span>
            )}
            {modelError && (
              <span className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
                {modelError}
              </span>
            )}
          </div>
        </header>

        {clothingSummary.length > 0 && (
          <section className="rounded-3xl bg-white/90 p-10 shadow-lg">
            <h2 className="mb-6 text-2xl font-semibold">
              Résultats & scripts UGC
            </h2>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {enhanced.map((item) => (
                <article
                  key={item.id}
                  className="flex flex-col gap-6 rounded-2xl border border-neutral-100 bg-white p-6 transition hover:shadow-md"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <h3 className="text-lg font-semibold">{item.name}</h3>
                      <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">
                        {item.width}×{item.height}px • upscale ×{item.scale}
                      </p>
                    </div>
                    <div className="flex gap-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                      {item.clothing.length > 0 ? (
                        item.clothing.map((label) => (
                          <span
                            key={label}
                            className="rounded-full bg-neutral-100 px-3 py-1 text-neutral-600"
                          >
                            {label}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full bg-neutral-100 px-3 py-1 text-neutral-400">
                          Pièces non détectées
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,_1fr)_minmax(0,_1fr)]">
                    <figure className="flex flex-col gap-3">
                      <img
                        src={item.originalUrl}
                        alt={item.name}
                        className="w-full rounded-xl border border-neutral-200 object-contain"
                      />
                      <figcaption className="text-xs text-neutral-500">
                        Original
                      </figcaption>
                    </figure>
                    <figure className="flex flex-col gap-3">
                      <img
                        src={item.enhancedUrl}
                        alt={`${item.name} optimisée`}
                        className="w-full rounded-xl border border-neutral-200 object-contain"
                      />
                      <figcaption className="text-xs text-neutral-500">
                        Optimisée
                      </figcaption>
                    </figure>
                  </div>

                  <div className="rounded-2xl bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-700">
                    {item.script}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <a
                      href={URL.createObjectURL(item.enhancedBlob)}
                      download={`${stripExtension(item.name)}-enhanced.png`}
                      className="rounded-full border border-neutral-800 px-5 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-900 hover:text-white"
                    >
                      Télécharger l’image HD
                    </a>
                    <button
                      disabled={videoBusy}
                      onClick={() => onGenerateVideo(item)}
                      className={clsx(
                        "rounded-full px-5 py-2 text-sm font-medium transition",
                        videoBusy
                          ? "cursor-not-allowed border border-neutral-300 bg-neutral-200 text-neutral-500"
                          : "bg-black text-white hover:bg-neutral-800"
                      )}
                    >
                      Générer la vidéo UGC
                    </button>
                    {item.videoBlob && (
                      <a
                        href={URL.createObjectURL(item.videoBlob)}
                        download={`${stripExtension(item.name)}-ugc.mp4`}
                        className="rounded-full border border-neutral-800 px-5 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-900 hover:text-white"
                      >
                        Télécharger la vidéo (.mp4)
                      </a>
                    )}
                    {item.videoUrl && (
                      <video
                        src={item.videoUrl}
                        controls
                        className="mt-2 w-full max-w-md rounded-2xl border border-neutral-200"
                      />
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function stripExtension(name: string) {
  const index = name.lastIndexOf(".");
  return index === -1 ? name : name.slice(0, index);
}

function ControlCard({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-neutral-100 bg-white/80 p-4 shadow-sm">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-400">
          {title}
        </span>
        <p className="text-sm text-neutral-500">{description}</p>
      </div>
      {children}
    </div>
  );
}

function Slider({
  min,
  max,
  step,
  value,
  onChange
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 flex-1 appearance-none rounded-full bg-neutral-200 accent-black"
      />
      <span className="w-16 text-right text-sm font-semibold text-neutral-700">
        {value.toFixed(2)}
      </span>
    </div>
  );
}

async function enhanceOne(file: File, opts: ProcessingOptions) {
  const imageBitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = imageBitmap.width * opts.scale;
  canvas.height = imageBitmap.height * opts.scale;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Impossible d’accéder au canvas.");
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.filter = `brightness(${opts.brightness}) saturate(${opts.saturation})`;
  ctx.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  if (opts.sharpen > 0) {
    const sharpened = applySharpen(imageData, opts.sharpen);
    ctx.putImageData(sharpened, 0, 0);
  } else {
    ctx.putImageData(imageData, 0, 0);
  }
  const blob = await canvasToBlob(canvas, "image/png", 0.98);
  const enhancedUrl = URL.createObjectURL(blob);
  return { canvas, blob, url: enhancedUrl };
}

function applySharpen(imageData: ImageData, intensity: number) {
  const { width, height, data } = imageData;
  const copy = new Uint8ClampedArray(data);
  const weights = [
    0,
    -1 * intensity,
    0,
    -1 * intensity,
    1 + 4 * intensity,
    -1 * intensity,
    0,
    -1 * intensity,
    0
  ];
  const getIndex = (x: number, y: number) => (y * width + x) * 4;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let weightIndex = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = getIndex(x + kx, y + ky);
          const weight = weights[weightIndex++];
          r += copy[idx] * weight;
          g += copy[idx + 1] * weight;
          b += copy[idx + 2] * weight;
        }
      }
      const dest = getIndex(x, y);
      data[dest] = clamp(data[dest] + r);
      data[dest + 1] = clamp(data[dest + 1] + g);
      data[dest + 2] = clamp(data[dest + 2] + b);
    }
  }
  return new ImageData(data, width, height);
}

function clamp(value: number) {
  return Math.max(0, Math.min(255, value));
}

async function detectClothing(
  canvas: HTMLCanvasElement,
  cocoModel: any,
  mobilenetModel: any
) {
  const image = new Image();
  image.src = canvas.toDataURL("image/png");
  await image.decode();

  const detected = new Set<string>();

  if (cocoModel) {
    const predictions = await cocoModel.detect(image, 10);
    for (const prediction of predictions) {
      if (cocoClothingLabels.has(prediction.class)) {
        const cleaned = normalizeLabel(prediction.class);
        detected.add(cleaned);
      }
    }
  }

  if (mobilenetModel) {
    const predictions = await mobilenetModel.classify(image);
    for (const prediction of predictions) {
      const normalized = prediction.className.toLowerCase();
      for (const keyword of clothingKeywords) {
        if (normalized.includes(keyword)) {
          detected.add(normalizeLabel(keyword));
        }
      }
    }
  }

  return Array.from(detected);
}

function normalizeLabel(label: string) {
  return label
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildScript(items: string[], brand: string, vibe: string) {
  const mentionBrand = brand ? `${brand} ` : "";
  const intro = {
    casual: "Hello la team, je vous montre ma tenue du jour ultra comfy !",
    minimal: "Mood épuré aujourd’hui, on mise sur les essentiels bien cut.",
    luxury: "Zoom sur une pièce premium qui apporte tout le glow à la tenue.",
    street: "Style street du jour, effortless et super stylé.",
    romantic: "Envie d’un look doux et romantique, je vous montre ça !"
  }[vibe]!;

  const core =
    items.length > 0
      ? `On adore ${
          items.length === 1
            ? `le ${items[0].toLowerCase()}`
            : `${items
                .slice(0, -1)
                .map((item) => item.toLowerCase())
                .join(", ")} et le ${items[items.length - 1].toLowerCase()}`
        }, c’est super flatteur et méga confortable.`
      : "La silhouette reste fluide et confortable, parfaite pour bouger toute la journée.";

  const vibeLine = {
    casual: "Je suis prête pour enchaîner mes petits rendez-vous cosy.",
    minimal: "Tout est ultra clean, sans prise de tête, juste chic.",
    luxury: "Chaque détail respire la qualité, c’est absolument sublime.",
    street: "Ça match avec mes sneakers du moment et ça donne une vibe très cool.",
    romantic: "Les volumes sont légers, c’est le combo parfait pour un mood délicat."
  }[vibe]!;

  const outro = "Dites-moi ce que vous en pensez et stay tuned pour la suite !";

  return `${intro} ${mentionBrand}${core} ${vibeLine} ${outro}`;
}

async function createVideoFromImage(
  item: EnhancedImage,
  vibe: string,
  brand: string,
  script: string
) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas non disponible pour la vidéo.");
  }

  const image = await loadImage(item.enhancedUrl);
  const duration = 12_000;
  const fps = 30;
  const totalFrames = Math.floor((duration / 1000) * fps);
  const stream = (canvas as HTMLCanvasElement).captureStream(fps);
  const recorder = new MediaRecorder(stream, {
    mimeType: "video/webm; codecs=vp9"
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  const brandingText = brand ? `#${brand.replace(/\s+/g, "")}` : "";
  const accent = {
    casual: "#FFC285",
    minimal: "#D6E4E5",
    luxury: "#F8E3A1",
    street: "#CBD5FF",
    romantic: "#F9D5E5"
  }[vibe]!;

  const lines = wrapText(script, 28, 680);

  let frame = 0;

  const animate = () => {
    const progress = frame / totalFrames;
    drawVideoFrame(ctx, image, canvas.width, canvas.height, progress, accent, lines, brandingText);
    frame += 1;
    if (frame <= totalFrames) {
      requestAnimationFrame(animate);
    } else {
      recorder.stop();
    }
  };

  const recording = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      resolve(blob);
    };
  });

  recorder.start();
  animate();
  const webmBlob = await recording;
  const mp4Blob = await transcodeToMp4(webmBlob);
  const videoUrl = URL.createObjectURL(mp4Blob);
  return { videoUrl, videoBlob: mp4Blob };
}

function drawVideoFrame(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
  progress: number,
  accent: string,
  lines: string[],
  brandingText: string
) {
  ctx.fillStyle = "#101010";
  ctx.fillRect(0, 0, width, height);

  const zoom = 1.05 + progress * 0.15;
  const offsetX = Math.sin(progress * Math.PI * 2) * 40;
  const offsetY = Math.cos(progress * Math.PI * 2) * 30;

  const imageRatio = image.width / image.height;
  const canvasRatio = width / height;
  let drawWidth = width;
  let drawHeight = height;
  if (imageRatio > canvasRatio) {
    drawHeight = height;
    drawWidth = drawHeight * imageRatio;
  } else {
    drawWidth = width;
    drawHeight = drawWidth / imageRatio;
  }
  const centerX = width / 2;
  const centerY = height / 2;
  const scaledWidth = drawWidth * zoom;
  const scaledHeight = drawHeight * zoom;
  ctx.save();
  ctx.translate(centerX + offsetX, centerY + offsetY);
  ctx.drawImage(image, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
  ctx.restore();

  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.8;
  ctx.fillRect(60, height - 520, width - 120, 420);
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#111";
  ctx.font = "bold 48px 'Inter', sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText("Style & confort", 100, height - 480);

  ctx.fillStyle = "#222";
  ctx.font = "32px 'Inter', sans-serif";
  let textY = height - 420;
  for (const line of lines) {
    ctx.fillText(line, 100, textY);
    textY += 48;
  }

  if (brandingText) {
    ctx.fillStyle = "#111";
    ctx.font = "bold 36px 'Inter', sans-serif";
    ctx.fillText(brandingText, 100, height - 80);
  }
}

function wrapText(text: string, fontSize: number, maxWidth: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    const tentative = currentLine ? `${currentLine} ${word}` : word;
    if (tentative.length * (fontSize * 0.55) > maxWidth) {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    } else {
      currentLine = tentative;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Impossible de charger l’image."));
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Impossible de générer le blob."));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}

async function transcodeToMp4(webmBlob: Blob) {
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const { fetchFile } = await import("@ffmpeg/util");
  const ffmpeg = new FFmpeg();
  await ffmpeg.load();
  const data = await fetchFile(webmBlob);
  await ffmpeg.writeFile("input.webm", data);
  await ffmpeg.exec([
    "-i",
    "input.webm",
    "-r",
    "30",
    "-vf",
    "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "output.mp4"
  ]);
  const fileData = (await ffmpeg.readFile("output.mp4")) as Uint8Array;
  const safeBytes = new Uint8Array(fileData.length);
  safeBytes.set(fileData);
  const blob = new Blob([safeBytes], { type: "video/mp4" });
  await ffmpeg.deleteFile("input.webm");
  await ffmpeg.deleteFile("output.mp4");
  return blob;
}
