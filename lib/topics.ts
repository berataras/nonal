import type { TLanguage, TMode } from "@/lib/types";

export const TOPICS = [
  "bilim",
  "teknoloji",
  "tarih",
  "felsefe",
  "sanat",
  "müzik",
  "sinema",
  "doğa",
  "psikoloji",
  "yemek",
] as const;

export type TTopic = (typeof TOPICS)[number];

interface ITopicRecord {
  near: readonly TTopic[];
  queries: {
    tr: readonly string[];
    en: readonly string[];
  };
}

export const topicGraph = {
  bilim: {
    near: ["teknoloji", "doğa", "psikoloji"],
    queries: {
      tr: ["kuantum", "evrim", "sinirbilim", "iklim bilimi", "astronomi"],
      en: ["quantum physics", "evolution", "neuroscience", "climate science", "astronomy"],
    },
  },
  teknoloji: {
    near: ["bilim", "psikoloji"],
    queries: {
      tr: ["robotik", "şifreleme", "yarı iletken", "yazılım mühendisliği"],
      en: ["robotics", "cryptography", "semiconductors", "software engineering"],
    },
  },
  tarih: {
    near: ["felsefe", "sanat"],
    queries: {
      tr: ["osmanlı tarihi", "antik roma", "sanayi devrimi", "arkeoloji"],
      en: ["ottoman history", "ancient rome", "industrial revolution", "archaeology"],
    },
  },
  felsefe: {
    near: ["tarih", "psikoloji"],
    queries: {
      tr: ["etik", "varoluşçuluk", "stoacılık", "epistemoloji"],
      en: ["ethics", "existentialism", "stoicism", "epistemology"],
    },
  },
  sanat: {
    near: ["sinema", "müzik", "tarih"],
    queries: {
      tr: ["resim sanatı", "heykel", "çağdaş sanat", "sanat tarihi"],
      en: ["painting", "sculpture", "contemporary art", "art history"],
    },
  },
  müzik: {
    near: ["sanat", "sinema"],
    queries: {
      tr: ["caz tarihi", "klasik müzik", "halk müziği", "beste"],
      en: ["jazz history", "classical music", "folk music", "composition"],
    },
  },
  sinema: {
    near: ["sanat", "müzik"],
    queries: {
      tr: ["belgesel film", "film kuramı", "kısa film", "sinema tarihi"],
      en: ["documentary film", "film theory", "short film", "cinema history"],
    },
  },
  doğa: {
    near: ["bilim", "yemek"],
    queries: {
      tr: ["ekoloji", "kuş gözlemi", "jeoloji", "okyanus"],
      en: ["ecology", "birdwatching", "geology", "ocean"],
    },
  },
  psikoloji: {
    near: ["felsefe", "bilim"],
    queries: {
      tr: ["bilişsel psikoloji", "bağlanma", "bellek", "davranış"],
      en: ["cognitive psychology", "attachment theory", "memory", "behavior"],
    },
  },
  yemek: {
    near: ["doğa", "tarih"],
    queries: {
      tr: ["yemek tarihi", "ekmek yapımı", "fermantasyon", "mutfak kültürü"],
      en: ["food history", "bread baking", "fermentation", "culinary culture"],
    },
  },
} as const satisfies Record<TTopic, ITopicRecord>;

const topicSet = new Set<string>(TOPICS);

export function isTopic(value: unknown): value is TTopic {
  return typeof value === "string" && topicSet.has(value);
}

export function pickRandom<T>(items: readonly T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

export function pickQuery(topic: TTopic, language: TLanguage): string {
  const queries = topicGraph[topic].queries;
  if (language === "all") {
    const bag = Math.random() < 0.5 ? queries.tr : queries.en;
    return pickRandom(bag) ?? bag[0];
  }
  return pickRandom(queries[language]) ?? queries[language][0];
}

export function pickTopic(
  mode: TMode,
  currentTopic: TTopic | null,
  home: readonly TTopic[],
): TTopic | null {
  const center = [...new Set(home)];
  if (!currentTopic) {
    if (mode === "same") return pickRandom(center.length > 0 ? center : TOPICS) ?? null;
    if (mode === "near") {
      const origin = pickRandom(center.length > 0 ? center : TOPICS);
      if (!origin) return null;
      return pickRandom(topicGraph[origin].near) ?? origin;
    }
    return pickRandom(topicsOutsideCenter(center)) ?? null;
  }

  if (mode === "same") return currentTopic;
  if (mode === "near") return pickRandom(topicGraph[currentTopic].near) ?? currentTopic;

  const nearby = new Set<TTopic>([currentTopic, ...topicGraph[currentTopic].near]);
  return pickRandom(TOPICS.filter((topic) => !nearby.has(topic))) ?? currentTopic;
}

function topicsOutsideCenter(center: readonly TTopic[]): TTopic[] {
  if (center.length === 0) return [...TOPICS];

  const excluded = new Set<TTopic>(center);
  for (const topic of center) {
    for (const neighbor of topicGraph[topic].near) excluded.add(neighbor);
  }

  const distant = TOPICS.filter((topic) => !excluded.has(topic));
  if (distant.length > 0) return [...distant];

  const outsideHome = TOPICS.filter((topic) => !center.includes(topic));
  if (outsideHome.length > 0) return [...outsideHome];
  return [...TOPICS];
}
