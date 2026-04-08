import type { ChallengeFileInput, CommunityChallengeSetting } from "@pkcprotocol/pkc-js/dist/node/challenges";
/**
 * Challenge file factory function
 */
declare function ChallengeFileFactory({ challengeSettings }: {
    challengeSettings: CommunityChallengeSetting;
}): ChallengeFileInput;
export default ChallengeFileFactory;
