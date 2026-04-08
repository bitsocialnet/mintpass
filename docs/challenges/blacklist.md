# Blacklist challenge

API: https://github.com/pkcprotocol/pkc-js/tree/master/src/runtime/node/community/challenges/pkc-js-challenges

Code: 
```ts
import { Challenge, ChallengeFile, ChallengeResult, CommunityChallengeSetting } from "../../../../../community/types.js";
import type { DecryptedChallengeRequestMessageTypeWithCommunityAuthor } from "../../../../../pubsub-messages/types.js";
import { derivePublicationFromChallengeRequest } from "../../../../../util.js";

const optionInputs = <NonNullable<ChallengeFile["optionInputs"]>>[
    {
        option: "blacklist",
        label: "Blacklist",
        default: "",
        description: "Comma separated list of author addresses to be blacklisted.",
        placeholder: `address1.eth,address2.eth,address3.eth`
    },
    {
        option: "error",
        label: "Error",
        default: `You're blacklisted.`,
        description: "The error to display to the author.",
        placeholder: `You're blacklisted.`
    }
];

const type: Challenge["type"] = "text/plain";

const description = "Blacklist author addresses.";

const getChallenge = async (
    communityChallengeSettings: CommunityChallengeSetting,
    challengeRequestMessage: DecryptedChallengeRequestMessageTypeWithCommunityAuthor,
    challengeIndex: number
): Promise<ChallengeResult> => {
    // add a custom error message to display to the author
    const error = communityChallengeSettings?.options?.error;
    const blacklist = communityChallengeSettings?.options?.blacklist?.split(",");
    const blacklistSet = new Set(blacklist);

    const publication = derivePublicationFromChallengeRequest(challengeRequestMessage);
    if (blacklistSet.has(publication?.author?.address)) {
        return {
            success: false,
            error: error || `You're blacklisted.`
        };
    }

    return {
        success: true
    };
};

function ChallengeFileFactory(communityChallengeSettings: CommunityChallengeSetting): ChallengeFile {
    return { getChallenge, optionInputs, type, description };
}

export default ChallengeFileFactory;
```ts
