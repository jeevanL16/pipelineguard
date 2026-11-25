export const HERO_BROKEN_WORKFLOW = `name: release
on:
  pull_request_target:
    branches: [main]
permissions: write-all
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ github.event.pull_request.head.sha }}
      - uses: vendor/deploy-action@v3
      - run: echo "token=\${{ secrets.NPM_TOKEN }}"
      - run: ./build.sh "\${{ github.event.pull_request.title }}"`;

export const HERO_FIXED_WORKFLOW = `name: release
on:
  pull_request:
    branches: [main]
permissions:
  contents: read
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4
        with:
          persist-credentials: false
      - uses: vendor/deploy-action@0123456789abcdef0123456789abcdef01234567 # v3
      - run: ./build.sh "$PR_TITLE"
        env:
          PR_TITLE: \${{ github.event.pull_request.title }}`;

export interface PlaygroundSample {
  id: string;
  label: string;
  filename: string;
  yaml: string;
}

export const PLAYGROUND_SAMPLES: readonly PlaygroundSample[] = [
  {
    id: "unpinned-action",
    label: "Unpinned action",
    filename: "release.yml",
    yaml: `name: release
on: [push]
permissions:
  contents: read
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
        with:
          persist-credentials: false
      - uses: third-party/upload-release@v2
      - run: echo "Release uploaded"`,
  },
  {
    id: "secret-in-log",
    label: "Secret in a log",
    filename: "publish.yml",
    yaml: `name: publish
on: [push]
permissions:
  contents: read
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
        with:
          persist-credentials: false
      - run: echo "Publishing with token=\${{ secrets.NPM_TOKEN }}"`,
  },
  {
    id: "pr-title-injection",
    label: "Pull request title in a shell command",
    filename: "pr-check.yml",
    yaml: `name: pr-check
on:
  pull_request_target:
    branches: [main]
permissions:
  contents: read
jobs:
  greet:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
        with:
          ref: \${{ github.event.pull_request.head.sha }}
          persist-credentials: false
      - run: ./scripts/lint-title.sh "\${{ github.event.pull_request.title }}"`,
  },
];

export interface SecretPatternRule {
  id: string;
  name: string;
  pattern: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  action: "BLOCK";
  description: string;
}

/** Mirrored from security/secrets/severity.py */
export const SECRET_PATTERN_RULES: readonly SecretPatternRule[] = [
  {
    id: "private-key",
    name: "Private RSA / PEM / SSH Key",
    pattern: "-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY-----",
    severity: "CRITICAL",
    action: "BLOCK",
    description: "Private cryptographic key committed or echoed in workflow logs.",
  },
  {
    id: "aws-access-token",
    name: "AWS Access Key ID",
    pattern: "AKIA[0-9A-Z]{16}",
    severity: "HIGH",
    action: "BLOCK",
    description: "Amazon Web Services long-lived IAM access token.",
  },
  {
    id: "github-pat",
    name: "GitHub Personal Access Token",
    pattern: "ghp_[0-9a-zA-Z]{36}",
    severity: "HIGH",
    action: "BLOCK",
    description: "GitHub classic or fine-grained personal access token.",
  },
  {
    id: "stripe-access-token",
    name: "Stripe Live Secret Key",
    pattern: "sk_live_[0-9a-zA-Z]{24,}",
    severity: "HIGH",
    action: "BLOCK",
    description: "Stripe payment secret key in pipeline source or config.",
  },
  {
    id: "generic-api-key",
    name: "High-Entropy Generic API Credential",
    pattern: "(api_key|password|secret)\\s*=\\s*<entropy >= 4.5>",
    severity: "HIGH",
    action: "BLOCK",
    description: "Plain assignment containing high-entropy key material.",
  },
];
