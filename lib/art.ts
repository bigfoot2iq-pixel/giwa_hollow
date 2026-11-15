/**
 * ARIWA collection art.
 *
 * Every character in the collection is a soft, hand-crafted resident of the
 * Hollow: one huge glossy eye, one wink, and a knitted hat. The site borrows
 * its whole identity from these files — the pastel backgrounds become panels,
 * the eyes become accents, and the plush surfaces become the card language.
 *
 * The `bunny` / `bee` / `pumpkin` keys are kept for screens that predate the
 * collection and still reference them by name.
 */

export type ArtTone =
  | "butter"
  | "blush"
  | "sky"
  | "mint"
  | "lilac"
  | "peach"
  | "ink";

export type NftPiece = {
  id: number;
  src: string;
  alt: string;
  name: string;
  role: string;
  trait: string;
  tone: ArtTone;
  /** The dominant eye colour, used for the little halo behind the card. */
  eye: string;
};

export const ART = {
  bunny: {
    src: "/art/nft/1.webp",
    alt: "Sunny, a pale-blue Hollow resident wearing a sunflower crown",
    name: "Sunny",
  },
  bee: {
    src: "/art/nft/2112.webp",
    alt: "Buzz, a pink Hollow resident wearing a striped bee beanie with tiny wings",
    name: "Buzz",
  },
  pumpkin: {
    src: "/art/nft/314.webp",
    alt: "Sprout, a peach Hollow resident wearing a leafy green beanie",
    name: "Sprout",
  },
} as const;

export const ART_LIST = [ART.bunny, ART.bee, ART.pumpkin] as const;

export const NFT_PIECES: NftPiece[] = [
  {
    id: 1,
    src: "/art/nft/1.webp",
    alt: "Sunny, a pale-blue Hollow resident wearing a sunflower crown",
    name: "Sunny",
    role: "The Gardener",
    trait: "Sunflower Crown",
    tone: "butter",
    eye: "#a64bd6",
  },
  {
    id: 777,
    src: "/art/nft/777.webp",
    alt: "Beary, a golden Hollow resident wearing a fuzzy bear beanie",
    name: "Beary",
    role: "The Hugger",
    trait: "Bear Beanie",
    tone: "blush",
    eye: "#e2a51f",
  },
  {
    id: 2222,
    src: "/art/nft/2222.webp",
    alt: "Cloud, a lavender Hollow resident wearing a cloud beanie with a rainbow eye",
    name: "Cloud",
    role: "The Dreamer",
    trait: "Cloud Beanie",
    tone: "sky",
    eye: "#ef7f4f",
  },
  {
    id: 2112,
    src: "/art/nft/2112.webp",
    alt: "Buzz, a pink Hollow resident wearing a striped bee beanie with tiny wings",
    name: "Buzz",
    role: "The Worker",
    trait: "Bee Beanie",
    tone: "butter",
    eye: "#e2693b",
  },
  {
    id: 1000,
    src: "/art/nft/1000.webp",
    alt: "Luna, a pale Hollow resident wearing a lavender cat-ear beanie",
    name: "Luna",
    role: "The Stargazer",
    trait: "Cat-Ear Beanie",
    tone: "mint",
    eye: "#7448e8",
  },
  {
    id: 512,
    src: "/art/nft/512.webp",
    alt: "Cherry, a lavender Hollow resident wearing a cream beanie topped with cherries",
    name: "Cherry",
    role: "The Sweetheart",
    trait: "Cherry Beanie",
    tone: "butter",
    eye: "#7357d8",
  },
  {
    id: 2020,
    src: "/art/nft/2020.webp",
    alt: "Iris, a pale Hollow resident wearing a purple cat-ear beanie",
    name: "Iris",
    role: "The Seer",
    trait: "Cat-Ear Beanie",
    tone: "lilac",
    eye: "#4d7df0",
  },
  {
    id: 314,
    src: "/art/nft/314.webp",
    alt: "Sprout, a peach Hollow resident wearing a leafy green beanie",
    name: "Sprout",
    role: "The Grower",
    trait: "Leaf Beanie",
    tone: "mint",
    eye: "#8ed6a8",
  },
];

/** Extra residents used by the moving gallery rail. */
export const GALLERY_PIECES: NftPiece[] = [
  ...NFT_PIECES,
  {
    id: 42,
    src: "/art/nft/42.webp",
    alt: "Wisp, a blue Hollow resident wearing a cloud beanie",
    name: "Wisp",
    role: "The Wanderer",
    trait: "Cloud Beanie",
    tone: "mint",
    eye: "#b9a4ff",
  },
  {
    id: 100,
    src: "/art/nft/100.webp",
    alt: "Muse, a peach Hollow resident wearing a red beret",
    name: "Muse",
    role: "The Muse",
    trait: "Red Beret",
    tone: "sky",
    eye: "#45d6c1",
  },
  {
    id: 1234,
    src: "/art/nft/1234.webp",
    alt: "Rouge, a lilac Hollow resident wearing a red beret",
    name: "Rouge",
    role: "The Painter",
    trait: "Red Beret",
    tone: "peach",
    eye: "#3f8ff5",
  },
  {
    id: 1337,
    src: "/art/nft/1337.webp",
    alt: "Pip, a blue Hollow resident wearing a cherry beanie",
    name: "Pip",
    role: "The Lucky One",
    trait: "Cherry Beanie",
    tone: "sky",
    eye: "#3f8ff5",
  },
  {
    id: 1500,
    src: "/art/nft/1500.webp",
    alt: "Rose, a pink Hollow resident wearing a leaf beanie",
    name: "Rose",
    role: "The Bloom",
    trait: "Leaf Beanie",
    tone: "mint",
    eye: "#3f8ff5",
  },
  {
    id: 1777,
    src: "/art/nft/1777.webp",
    alt: "Fern, a lilac Hollow resident wearing a lilac beanie with a leaf",
    name: "Fern",
    role: "The Forager",
    trait: "Swirl Beanie",
    tone: "peach",
    eye: "#63ddc2",
  },
  {
    id: 2000,
    src: "/art/nft/2000.webp",
    alt: "Prism, a pink Hollow resident wearing a bear beanie with a rainbow eye",
    name: "Prism",
    role: "The Rainbow",
    trait: "Bear Beanie",
    tone: "sky",
    eye: "#ef7f4f",
  },
  {
    id: 888,
    src: "/art/nft/888.webp",
    alt: "Moth, a mint-green Hollow resident wearing a lilac beanie in the dark",
    name: "Moth",
    role: "The Night Owl",
    trait: "Swirl Beanie",
    tone: "ink",
    eye: "#3f8ff5",
  },
];

export const ART_TONES: Record<
  ArtTone,
  { panel: string; border: string; chip: string; glow: string }
> = {
  butter: {
    panel: "tone-panel-butter",
    border: "tone-border-butter",
    chip: "tone-chip-butter",
    glow: "var(--tone-butter-glow)",
  },
  blush: {
    panel: "tone-panel-blush",
    border: "tone-border-blush",
    chip: "tone-chip-blush",
    glow: "var(--tone-blush-glow)",
  },
  sky: {
    panel: "tone-panel-sky",
    border: "tone-border-sky",
    chip: "tone-chip-sky",
    glow: "var(--tone-sky-glow)",
  },
  mint: {
    panel: "tone-panel-mint",
    border: "tone-border-mint",
    chip: "tone-chip-mint",
    glow: "var(--tone-mint-glow)",
  },
  lilac: {
    panel: "tone-panel-lilac",
    border: "tone-border-lilac",
    chip: "tone-chip-lilac",
    glow: "var(--tone-lilac-glow)",
  },
  peach: {
    panel: "tone-panel-peach",
    border: "tone-border-peach",
    chip: "tone-chip-peach",
    glow: "var(--tone-peach-glow)",
  },
  ink: {
    panel: "tone-panel-ink",
    border: "tone-border-ink",
    chip: "tone-chip-ink",
    glow: "var(--tone-ink-glow)",
  },
};

export const HERO_PIECE = NFT_PIECES[0];
