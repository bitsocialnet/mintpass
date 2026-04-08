# Fail challenge

API: https://github.com/pkcprotocol/pkc-js/tree/master/src/runtime/node/community/challenges/pkc-js-challenges

Code:

```ts
// the purpose of this challenge is to always fail, can be used with CommunityChallenge.exclude to whitelist users

import type { Challenge, ChallengeFile, CommunityChallengeSetting } from "../../../../../community/types.js";
import type { DecryptedChallengeRequestMessageTypeWithCommunityAuthor } from "../../../../../pubsub-messages/types.js";

const optionInputs = <NonNullable<ChallengeFile["optionInputs"]>>[
    {
        option: "error",
        label: "Error",
        default: `You're not allowed to publish.`,
        description: "The error to display to the author.",
        placeholder: `You're not allowed to publish.`
    }
];

const type: Challenge["type"] = "text/plain";

const description = "A challenge that automatically fails with a custom error message.";

const getChallenge = async (
    communityChallengeSettings: CommunityChallengeSetting,
    challengeRequestMessage: DecryptedChallengeRequestMessageTypeWithCommunityAuthor,
    challengeIndex: number
) => {
    // add a custom error message to display to the author
    const error = communityChallengeSettings?.options?.error;

    // the only way to succeed the 'fail' challenge is to be excluded
    return {
        success: false,
        error: error || `You're not allowed to publish.`
    };
};

function ChallengeFileFactory(communityChallengeSettings: CommunityChallengeSetting): ChallengeFile {
    return { getChallenge, optionInputs, type, description };
}

export default ChallengeFileFactory;
```
