/**
 * ARIWA collection art.
 *
 * Every character in the collection is a soft, hand-crafted resident of the
 * ARIWA: one huge glossy eye, one wink, and a knitted hat. The site borrows
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
    alt: "Sunny, a pale-blue ARIWA resident wearing a sunflower crown",
    name: "Sunny",
  },
  bee: {
    src: "/art/nft/2112.webp",
    alt: "Buzz, a pink ARIWA resident wearing a striped bee beanie with tiny wings",
    name: "Buzz",
  },
  pumpkin: {
    src: "/art/nft/314.webp",
    alt: "Sprout, a peach ARIWA resident wearing a leafy green beanie",
    name: "Sprout",
  },
} as const;

export const ART_LIST = [ART.bunny, ART.bee, ART.pumpkin] as const;

export const NFT_PIECES: NftPiece[] = [
  {
    id: 1,
    src: "/art/nft/1.webp",
    alt: "Sunny, a pale-blue ARIWA resident wearing a sunflower crown",
    name: "Sunny",
    role: "The Gardener",
    trait: "Sunflower Crown",
    tone: "butter",
    eye: "#a64bd6",
  },
  {
    id: 777,
    src: "/art/nft/777.webp",
    alt: "Beary, a golden ARIWA resident wearing a fuzzy bear beanie",
    name: "Beary",
    role: "The Hugger",
    trait: "Bear Beanie",
    tone: "blush",
    eye: "#e2a51f",
  },
  {
    id: 2222,
    src: "/art/nft/2222.webp",
    alt: "Cloud, a lavender ARIWA resident wearing a cloud beanie with a rainbow eye",
    name: "Cloud",
    role: "The Dreamer",
    trait: "Cloud Beanie",
    tone: "sky",
    eye: "#ef7f4f",
  },
  {
    id: 2112,
    src: "/art/nft/2112.webp",
    alt: "Buzz, a pink ARIWA resident wearing a striped bee beanie with tiny wings",
    name: "Buzz",
    role: "The Worker",
    trait: "Bee Beanie",
    tone: "butter",
    eye: "#e2693b",
  },
  {
    id: 1000,
    src: "/art/nft/1000.webp",
    alt: "Luna, a pale ARIWA resident wearing a lavender cat-ear beanie",
    name: "Luna",
    role: "The Stargazer",
    trait: "Cat-Ear Beanie",
    tone: "mint",
    eye: "#7448e8",
  },
  {
    id: 512,
    src: "/art/nft/512.webp",
    alt: "Cherry, a lavender ARIWA resident wearing a cream beanie topped with cherries",
    name: "Cherry",
    role: "The Sweetheart",
    trait: "Cherry Beanie",
    tone: "butter",
    eye: "#7357d8",
  },
  {
    id: 2020,
    src: "/art/nft/2020.webp",
    alt: "Iris, a pale ARIWA resident wearing a purple cat-ear beanie",
    name: "Iris",
    role: "The Seer",
    trait: "Cat-Ear Beanie",
    tone: "lilac",
    eye: "#4d7df0",
  },
  {
    id: 314,
    src: "/art/nft/314.webp",
    alt: "Sprout, a peach ARIWA resident wearing a leafy green beanie",
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
    alt: "Wisp, a blue ARIWA resident wearing a cloud beanie",
    name: "Wisp",
    role: "The Wanderer",
    trait: "Cloud Beanie",
    tone: "mint",
    eye: "#b9a4ff",
  },
  {
    id: 100,
    src: "/art/nft/100.webp",
    alt: "Muse, a peach ARIWA resident wearing a red beret",
    name: "Muse",
    role: "The Muse",
    trait: "Red Beret",
    tone: "sky",
    eye: "#45d6c1",
  },
  {
    id: 1234,
    src: "/art/nft/1234.webp",
    alt: "Rouge, a lilac ARIWA resident wearing a red beret",
    name: "Rouge",
    role: "The Painter",
    trait: "Red Beret",
    tone: "peach",
    eye: "#3f8ff5",
  },
  {
    id: 1337,
    src: "/art/nft/1337.webp",
    alt: "Pip, a blue ARIWA resident wearing a cherry beanie",
    name: "Pip",
    role: "The Lucky One",
    trait: "Cherry Beanie",
    tone: "sky",
    eye: "#3f8ff5",
  },
  {
    id: 1500,
    src: "/art/nft/1500.webp",
    alt: "Rose, a pink ARIWA resident wearing a leaf beanie",
    name: "Rose",
    role: "The Bloom",
    trait: "Leaf Beanie",
    tone: "mint",
    eye: "#3f8ff5",
  },
  {
    id: 1777,
    src: "/art/nft/1777.webp",
    alt: "Fern, a lilac ARIWA resident wearing a lilac beanie with a leaf",
    name: "Fern",
    role: "The Forager",
    trait: "Swirl Beanie",
    tone: "peach",
    eye: "#63ddc2",
  },
  {
    id: 2000,
    src: "/art/nft/2000.webp",
    alt: "Prism, a pink ARIWA resident wearing a bear beanie with a rainbow eye",
    name: "Prism",
    role: "The Rainbow",
    trait: "Bear Beanie",
    tone: "sky",
    eye: "#ef7f4f",
  },
  {
    id: 888,
    src: "/art/nft/888.webp",
    alt: "Moth, a mint-green ARIWA resident wearing a lilac beanie in the dark",
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

/**
 * The real on-chain ARIWA residents.
 *
 * These are the actual token artworks referenced by the live collection (the
 * same files the `LEGACY_IMAGE_CID` directory serves), mirrored into
 * `/public/art/nft` so Cloudflare caches them instead of the Pinata gateway.
 * Their names and traits come from the on-chain metadata, not the placeholder
 * cast above.
 */
export interface AriwaPiece {
  id: number;
  src: string;
  name: string;
  alt: string;
  hat: string;
  eyes: string;
}

export const ARIWA_PIECES: AriwaPiece[] = [
  {
    id: 1,
    src: "/art/nft/1.png",
    name: "ARIWA #1",
    hat: "Leaf Beanie",
    eyes: "Blue Stare",
    alt: "ARIWA #1, a white resident with Blue Stare eyes and a Leaf Beanie",
  },
  {
    id: 2,
    src: "/art/nft/2.png",
    name: "ARIWA #2",
    hat: "Flat Strawberry",
    eyes: "Closed Left Heart",
    alt: "ARIWA #2, a white resident with a Closed Left Heart eye and a Flat Strawberry hat",
  },
  {
    id: 3,
    src: "/art/nft/3.png",
    name: "ARIWA #3",
    hat: "Beret",
    eyes: "Excited",
    alt: "ARIWA #3, a light-purple resident with Excited eyes and a Beret",
  },
  {
    id: 5,
    src: "/art/nft/5.png",
    name: "ARIWA #5",
    hat: "Pink Strawberry Hat",
    eyes: "Closed Left Heart",
    alt: "ARIWA #5, a purple resident with a Closed Left Heart eye and a Pink Strawberry Hat",
  },
  {
    id: 6,
    src: "/art/nft/6.png",
    name: "ARIWA #6",
    hat: "Sunflower",
    eyes: "Blue Right",
    alt: "ARIWA #6, a white resident with a Blue Right eye and a Sunflower hat",
  },
  {
    id: 7,
    src: "/art/nft/7.png",
    name: "ARIWA #7",
    hat: "Floral",
    eyes: "Red Wink",
    alt: "ARIWA #7, a shade-purple resident with a Red Wink and a Floral hat",
  },
  {
    id: 12,
    src: "/art/nft/12.png",
    name: "ARIWA #12",
    hat: "Pumpkin",
    eyes: "Blue Stare",
    alt: "ARIWA #12, a light-purple resident with Blue Stare eyes and a Pumpkin hat",
  },
  {
    id: 22,
    src: "/art/nft/22.png",
    name: "ARIWA #22",
    hat: "Pink Strawberry Hat",
    eyes: "Excited",
    alt: "ARIWA #22, a shade-purple resident with Excited eyes and a Pink Strawberry Hat",
  },
  {
    id: 27,
    src: "/art/nft/27.png",
    name: "ARIWA #27",
    hat: "Floral",
    eyes: "Right Rainbow Wink",
    alt: "ARIWA #27, a green resident with a Right Rainbow Wink and a Floral hat",
  },
  {
    id: 32,
    src: "/art/nft/32.png",
    name: "ARIWA #32",
    hat: "Cloud Beanie",
    eyes: "Right Rainbow Wink",
    alt: "ARIWA #32, a baby-pink resident with a Right Rainbow Wink and a Cloud Beanie",
  },
  {
    id: 33,
    src: "/art/nft/33.png",
    name: "ARIWA #33",
    hat: "Pink Strawberry Hat",
    eyes: "Mono Right Hypno",
    alt: "ARIWA #33, a pink resident with a Mono Right Hypno eye and a Pink Strawberry Hat",
  },
];

function ariwaById(id: number): AriwaPiece {
  const piece = ARIWA_PIECES.find((candidate) => candidate.id === id);
  if (!piece) throw new Error(`Unknown ARIWA piece ${id}`);
  return piece;
}

/**
 * A compact three-resident set used on the home page to show how the eye —
 * the collection's defining trait — varies. Picked for the cleanest, most
 * distinct states: both open, left closed, right closed.
 */
export const HOME_EYE_PIECES = [
  { ...ariwaById(1), label: "Both eyes open" },
  { ...ariwaById(2), label: "Left eye closed" },
  { ...ariwaById(27), label: "Right eye closed" },
];

/**
 * The residents shown in the home page's "NFT Collection" grid, ordered to mix
 * the eye — the collection's signature trait — across its states: open stare,
 * excited, left closed, wink, right closed, and hypnotic.
 */
export const HOME_COLLECTION = [
  ariwaById(1), // Blue Stare — both open
  ariwaById(2), // Closed Left Heart — left closed
  ariwaById(3), // Excited — both open
  ariwaById(5), // Closed Left Heart — left closed
  ariwaById(7), // Red Wink
  ariwaById(22), // Excited — both open
  ariwaById(27), // Right Rainbow Wink — right closed
  ariwaById(33), // Mono Right Hypno
];

/**
 * The hero wall. A subset of the collection above (the hero footer says
 * "Selected from the collection") with the same eye-mixing rule.
 */
export const HOME_HERO = [
  ariwaById(1), // both open — the featured resident
  ariwaById(2), // left closed
  ariwaById(27), // right closed
  ariwaById(7), // wink
  ariwaById(22), // excited
];
