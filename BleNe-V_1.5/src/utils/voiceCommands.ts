/**
 * Voice command matcher utility
 * Performs fuzzy matching for voice commands with low confidence
 */

interface MatchResult {
    matched: boolean;
    confidence: number;
    command?: string;
}

// Define voice commands and their variations
const VOICE_COMMANDS = {
    // Dashboard access
    dashboard: [
        'i am visually impaired',
        'open dashboard',
        'go to dashboard',
        'visually impaired',
        'blind user',
        'need help',
    ],

    // Help requests
    helpRequest: [
        'i need help',
        'help me',
        'need assistance',
        'request help',
        'call for help',
        'assistance needed',
    ],

    // Confirmations
    yes: ['yes', 'yeah', 'yep', 'correct', 'right', 'confirm', 'proceed', 'ok', 'okay'],
    no: ['no', 'nope', 'cancel', 'stop', 'negative'],

    // Specific help types
    roadCrossing: [
        'cross the road',
        'crossing',
        'cross street',
        'help me cross',
        'road crossing',
    ],
    reading: [
        'read',
        'reading',
        'read this',
        'help me read',
        'what does this say',
    ],
    navigation: [
        'navigate',
        'navigation',
        'where am i',
        'find location',
        'help me find',
    ],
    identification: [
        'identify',
        'what is this',
        'describe',
        'tell me what',
    ],
};

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1, // deletion
                matrix[i][j - 1] + 1, // insertion
                matrix[i - 1][j - 1] + cost // substitution
            );
        }
    }

    return matrix[len1][len2];
}

/**
 * Calculate similarity score between two strings (0-1)
 */
function similarityScore(str1: string, str2: string): number {
    const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1 : 1 - distance / maxLength;
}

/**
 * Check if transcript contains keyword
 */
function containsKeyword(transcript: string, keyword: string): boolean {
    const words = transcript.toLowerCase().split(/\s+/);
    const keywordWords = keyword.toLowerCase().split(/\s+/);

    // Check if all keyword words appear in sequence in transcript
    for (let i = 0; i <= words.length - keywordWords.length; i++) {
        let match = true;
        for (let j = 0; j < keywordWords.length; j++) {
            if (similarityScore(words[i + j], keywordWords[j]) < 0.7) {
                match = false;
                break;
            }
        }
        if (match) return true;
    }

    return false;
}

/**
 * Match voice transcript to a command category
 */
export function matchVoiceCommand(
    transcript: string,
    commandCategory: keyof typeof VOICE_COMMANDS,
    threshold: number = 0.6
): MatchResult {
    if (!transcript || transcript.trim().length === 0) {
        return { matched: false, confidence: 0 };
    }

    const normalizedTranscript = transcript.toLowerCase().trim();
    const commands = VOICE_COMMANDS[commandCategory];

    let maxScore = 0;
    let bestMatch = '';

    for (const command of commands) {
        // Check for exact substring match
        if (normalizedTranscript.includes(command)) {
            return { matched: true, confidence: 1, command };
        }

        // Check for keyword containment
        if (containsKeyword(normalizedTranscript, command)) {
            const score = 0.9;
            if (score > maxScore) {
                maxScore = score;
                bestMatch = command;
            }
        }

        // Calculate similarity score
        const score = similarityScore(normalizedTranscript, command);
        if (score > maxScore) {
            maxScore = score;
            bestMatch = command;
        }
    }

    const matched = maxScore >= threshold;
    return {
        matched,
        confidence: maxScore,
        command: matched ? bestMatch : undefined,
    };
}

/**
 * Detect help request intent from transcript
 */
export function detectHelpIntent(transcript: string): {
    isHelpRequest: boolean;
    category?: string;
    confidence: number;
} {
    const helpMatch = matchVoiceCommand(transcript, 'helpRequest', 0.5);

    if (helpMatch.matched) {
        // Try to detect specific help category
        const categories = ['roadCrossing', 'reading', 'navigation', 'identification'] as const;
        let bestCategory: string | undefined;
        let maxCategoryScore = 0;

        for (const category of categories) {
            const categoryMatch = matchVoiceCommand(transcript, category, 0.6);
            if (categoryMatch.matched && categoryMatch.confidence > maxCategoryScore) {
                maxCategoryScore = categoryMatch.confidence;
                bestCategory = category;
            }
        }

        return {
            isHelpRequest: true,
            category: bestCategory,
            confidence: Math.max(helpMatch.confidence, maxCategoryScore),
        };
    }

    return {
        isHelpRequest: false,
        confidence: 0,
    };
}

/**
 * Generalize help description for privacy
 */
export function generalizeDescription(fullDescription: string): string {
    const normalized = fullDescription.toLowerCase();

    // Road crossing
    if (
        normalized.includes('cross') ||
        normalized.includes('road') ||
        normalized.includes('street')
    ) {
        return 'Road crossing assistance';
    }

    // Reading
    if (
        normalized.includes('read') ||
        normalized.includes('text') ||
        normalized.includes('sign')
    ) {
        return 'Reading assistance';
    }

    // Navigation
    if (
        normalized.includes('navigate') ||
        normalized.includes('find') ||
        normalized.includes('where') ||
        normalized.includes('location')
    ) {
        return 'Navigation assistance';
    }

    // Object identification
    if (
        normalized.includes('identify') ||
        normalized.includes('what is') ||
        normalized.includes('describe')
    ) {
        return 'Object identification';
    }

    // Default
    return 'General assistance needed';
}
