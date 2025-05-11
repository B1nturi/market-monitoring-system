// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ProductMetricsRegistry {
    // --- EVENTS ---
    event CompanyRegistered(address indexed company);
    event CompanyRevoked(address indexed company);
    event ProductMetricRecorded(
        uint256 indexed entryId,
        string companyId,
        address indexed fromAddress,
        string productID,
        string productOrigin,
        address indexed toCompanyAddress,
        string toCompanyId,
        uint256 sellingPrice,
        uint256 quantityBought,
        uint256 timestamp
    );

    // --- STRUCTS ---
    struct ProductMetrics {
        uint256 entryId;
        string companyId;
        address fromAddress;
        string productID;
        string productOrigin;
        address toCompanyAddress;
        string toCompanyId;
        uint256 sellingPrice;
        uint256 quantityBought;
        uint256 timestamp;
    }

    // --- STATE VARIABLES ---
    address public admin;
    uint256 public totalEntries = 0;

    mapping(address => bool) public isCompany;
    mapping(uint256 => ProductMetrics) public metrics;
    uint256[] public metricIds;

    // --- MODIFIERS ---
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    modifier onlyCompany() {
        require(isCompany[msg.sender], "Only registered company");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    // --- ADMIN FUNCTIONS ---
    function registerCompany(address company) external onlyAdmin {
        isCompany[company] = true;
        emit CompanyRegistered(company);
    }

    function revokeCompany(address company) external onlyAdmin {
        isCompany[company] = false;
        emit CompanyRevoked(company);
    }

    // --- COMPANY ACTION ---
    function recordProductMetric(
        string calldata companyId,
        string calldata productID,
        string calldata productOrigin,
        address toCompanyAddress,
        string calldata toCompanyId,
        uint256 sellingPrice,
        uint256 quantityBought
    ) external onlyCompany {
        require(isCompany[toCompanyAddress], "Receiver company is not registered");

        totalEntries++;
        metrics[totalEntries] = ProductMetrics({
            entryId: totalEntries,
            companyId: companyId,
            fromAddress: msg.sender,
            productID: productID,
            productOrigin: productOrigin,
            toCompanyAddress: toCompanyAddress,
            toCompanyId: toCompanyId,
            sellingPrice: sellingPrice,
            quantityBought: quantityBought,
            timestamp: block.timestamp
        });

        metricIds.push(totalEntries);

        emit ProductMetricRecorded(
            totalEntries,
            companyId,
            msg.sender,
            productID,
            productOrigin,
            toCompanyAddress,
            toCompanyId,
            sellingPrice,
            quantityBought,
            block.timestamp
        );
    }

    // --- ADMIN READ ACCESS ---
    function getAllMetrics() external view onlyAdmin returns (ProductMetrics[] memory) {
        ProductMetrics[] memory all = new ProductMetrics[](metricIds.length);
        for (uint256 i = 0; i < metricIds.length; i++) {
            all[i] = metrics[metricIds[i]];
        }
        return all;
    }
}
