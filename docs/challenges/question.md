# Question challenge

API: https://github.com/pkcprotocol/pkc-js/tree/master/src/runtime/node/community/challenges/pkc-js-challenges

Code:

```ts
import type { Challenge, ChallengeFile, ChallengeResult, CommunityChallengeSetting } from "../../../../../community/types.js";
import type { DecryptedChallengeRequestMessageTypeWithCommunityAuthor } from "../../../../../pubsub-messages/types.js";

const optionInputs = <NonNullable<ChallengeFile["optionInputs"]>>[
    {
        option: "question",
        label: "Question",
        default: "",
        description: "The question to answer.",
        placeholder: ""
    },
    {
        option: "answer",
        label: "Answer",
        default: "",
        description: "The answer to the question.",
        placeholder: "",
        required: true
    }
];

const type: Challenge["type"] = "text/plain";

const description = `Ask a question, like 'What is the password?'`;

const getChallenge = async (
    communityChallengeSettings: CommunityChallengeSetting,
    challengeRequestMessage: DecryptedChallengeRequestMessageTypeWithCommunityAuthor,
    challengeIndex: number
): Promise<Challenge | ChallengeResult> => {
    if (!communityChallengeSettings?.options?.question) throw Error("No option question");
    let answer = communityChallengeSettings?.options?.answer;
    if (!answer) {
        throw Error("no option answer");
    }

    // use the answer preincluded in the challenge request when possible
    const challengeAnswer = challengeRequestMessage?.challengeAnswers?.[challengeIndex];

    // the author didn't preinclude his answer, so send him a pubsub challenge message
    if (challengeAnswer === undefined) {
        return {
            challenge: communityChallengeSettings?.options?.question,
            verify: async (_answer: string) => {
                if (_answer === answer)
                    return {
                        success: true
                    };
                return {
                    success: false,
                    error: "Wrong answer."
                };
            },
            type
        };
    }

    // the author did preinclude his answer, but it's wrong, so send him a failed challenge verification
    if (challengeAnswer !== answer) {
        return {
            success: false,
            error: "Wrong answer."
        };
    }

    // the author did preinclude his answer, and it's correct, so send him a success challenge verification
    return {
        success: true
    };
};

function ChallengeFileFactory(communityChallengeSettings: CommunityChallengeSetting): ChallengeFile {
    // some challenges can prepublish the challenge so that it can be preanswered
    // in the challengeRequestMessage
    const question = communityChallengeSettings?.options?.question;
    const challenge = question;

    return { getChallenge, optionInputs, type, challenge, description };
}

export default ChallengeFileFactory;
```
