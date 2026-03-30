build:
	forge build

test:
	forge test -vvv

test-ci:
	forge test --profile ci

deploy-testnet:
	forge script script/Deploy.s.sol --rpc-url fhenix_testnet --broadcast

deploy-local:
	forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast

install:
	npm install
	forge install foundry-rs/forge-std --no-git || true
	forge install fhenixprotocol/cofhe-mock-contracts --no-git || true

.PHONY: build test test-ci deploy-testnet deploy-local install
