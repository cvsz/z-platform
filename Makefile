.PHONY: all install build test lint typecheck clean \
	gpg-commit gpg-push gpg-pull gpg-finalize

# Default to running the full validation pipeline
all: install lint typecheck build test

# ==========================================
# Full-Stack Orchestration
# ==========================================

install:
	@echo "==> Installing Node dependencies (pnpm workspace)..."
	pnpm install --ignore-scripts
	@echo "==> Installing Go dependencies (zctl)..."
	cd tools/zctl && go mod download

build:
	@echo "==> Building Next.js, AI Gateway, and Workspace packages..."
	pnpm run build
	@echo "==> Building Go CLI (zctl)..."
	$(MAKE) -C tools/zctl build

test:
	@echo "==> Testing Workspace (Node)..."
	pnpm run test
	@echo "==> Testing Go CLI (zctl)..."
	$(MAKE) -C tools/zctl test

lint:
	@echo "==> Linting Workspace (Node)..."
	pnpm run lint
	@echo "==> Linting Go CLI (zctl)..."
	$(MAKE) -C tools/zctl lint

typecheck:
	@echo "==> Typechecking Workspace (Node)..."
	pnpm run typecheck
	@echo "==> Vetting Go CLI (zctl)..."
	$(MAKE) -C tools/zctl vet

clean:
	@echo "==> Cleaning Workspace..."
	rm -rf node_modules
	find . -name 'node_modules' -type d -prune -exec rm -rf '{}' +
	@echo "==> Cleaning Go CLI (zctl)..."
	$(MAKE) -C tools/zctl clean

# ==========================================
# Git GPG Workflows
# ==========================================

gpg-commit:
	@test -n "$(COMMIT_MSG)" || (echo "ERROR: COMMIT_MSG is required. Usage: make gpg-commit COMMIT_MSG='your message'" && exit 1)
	git commit -S -m "$(COMMIT_MSG)"

gpg-push:
	git push

gpg-pull:
	git pull

gpg-finalize:
	@test -n "$(COMMIT_MSG)" || (echo "ERROR: COMMIT_MSG is required. Usage: make gpg-finalize COMMIT_MSG='your message'" && exit 1)
	git add .
	$(MAKE) gpg-commit COMMIT_MSG="$(COMMIT_MSG)"
	$(MAKE) gpg-push
