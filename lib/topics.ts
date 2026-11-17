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

export function pickRandom<T>(items: readonly T[], random: () => number = Math.random): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(random() * items.length)];
}

export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function pickQuery(topic: TTopic, language: TLanguage): string {
  const queries = topicGraph[topic].queries;
  if (language === "all") {
    const bag = Math.random() < 0.5 ? queries.tr : queries.en;
    return pickRandom(bag) ?? bag[0];
  }
  return pickRandom(queries[language]) ?? queries[language][0];
}

export function topicCandidates(
  mode: TMode,
  currentTopic: TTopic | null,
  random: () => number = Math.random,
): TTopic[] {
  if (!currentTopic) return shuffle(TOPICS, random);
  if (mode === "same") return [currentTopic];

  const nearby = relatedTopics(currentTopic);
  if (mode === "near") return shuffle(nearby, random);

  const excluded = new Set<TTopic>([currentTopic, ...nearby]);
  return shuffle(
    TOPICS.filter((topic) => !excluded.has(topic)),
    random,
  );
}

export function relatedTopics(topic: TTopic): TTopic[] {
  const related = new Set<TTopic>(topicGraph[topic].near);
  for (const candidate of TOPICS) {
    const candidateNeighbors: readonly TTopic[] = topicGraph[candidate].near;
    if (candidateNeighbors.includes(topic)) related.add(candidate);
  }
  related.delete(topic);
  return [...related];
}
