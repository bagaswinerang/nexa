// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {NexaAgentIdentity} from "../src/NexaAgentIdentity.sol";

contract DeployAgentIdentity is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        NexaAgentIdentity identity = new NexaAgentIdentity();
        console.log("NexaAgentIdentity deployed at:", address(identity));

        vm.stopBroadcast();
    }
}
