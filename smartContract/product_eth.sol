// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ProductRegistry {
    // --- EVENTS ---
    event ProductCreated(
        string indexed productID,
        string productName,
        string manufacturer,
        uint256 basePrice,
        address indexed company,
        uint256 timestamp
    );
    event ProductUpdated(
        string indexed productID,
        string productName,
        string manufacturer,
        uint256 basePrice,
        address indexed company,
        uint256 timestamp
    );
    event ProductDeleted(
        string indexed productID,
        address indexed company,
        uint256 timestamp
    );
    event CompanyRegistered(address indexed company);
    event CompanyRevoked(address indexed company);

    // --- ROLES ---
    address public admin;
    mapping(address => bool) public isCompany;

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }
    modifier onlyCompany() {
        require(isCompany[msg.sender], "Only registered company");
        _;
    }

    // --- PRODUCT DATA ---
    struct Product {
        string productID;
        string productName;
        string manufacturer;
        uint256 basePrice;
        address company;
        uint256 createdAt;
        uint256 updatedAt;
        bool exists;
    }

    // Lookup by productID
    mapping(string => Product) private products;
    // List of all productIDs ever created
    string[] private productList;

    modifier productExists(string memory id) {
        require(products[id].exists, "Product does not exist");
        _;
    }
    modifier onlyProductOwner(string memory id) {
        require(
            products[id].company == msg.sender,
            "Not owner of this product"
        );
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    // --- ADMIN CONTROLS ---
    function registerCompany(address company) external onlyAdmin {
        isCompany[company] = true;
        emit CompanyRegistered(company);
    }

    function revokeCompany(address company) external onlyAdmin {
        isCompany[company] = false;
        emit CompanyRevoked(company);
    }

    // --- COMPANY ACTIONS ---
    function createProduct(
        string calldata productID,
        string calldata productName,
        string calldata manufacturer,
        uint256 basePrice
    ) external onlyCompany {
        require(!products[productID].exists, "ProductID already used");

        products[productID] = Product({
            productID: productID,
            productName: productName,
            manufacturer: manufacturer,
            basePrice: basePrice,
            company: msg.sender,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            exists: true
        });
        productList.push(productID);

        emit ProductCreated(
            productID,
            productName,
            manufacturer,
            basePrice,
            msg.sender,
            block.timestamp
        );
    }

    function updateProduct(
        string calldata productID,
        string calldata productName,
        string calldata manufacturer,
        uint256 basePrice
    )
        external
        onlyCompany
        productExists(productID)
        onlyProductOwner(productID)
    {
        Product storage p = products[productID];
        p.productName = productName;
        p.manufacturer = manufacturer;
        p.basePrice = basePrice;
        p.updatedAt = block.timestamp;

        emit ProductUpdated(
            productID,
            productName,
            manufacturer,
            basePrice,
            msg.sender,
            block.timestamp
        );
    }

    function deleteProduct(string calldata productID)
        external
        onlyCompany
        productExists(productID)
        onlyProductOwner(productID)
    {
        // mark as non-existent
        delete products[productID];
        emit ProductDeleted(productID, msg.sender, block.timestamp);
    }

    // --- READERS ---
    /// Anyone can fetch a single product (or you could restrict to company/admin)
    function getProduct(string calldata productID)
        external
        view
        productExists(productID)
        returns (
            string memory,
            string memory,
            string memory,
            uint256,
            address,
            uint256,
            uint256
        )
    {
        Product storage p = products[productID];
        return (
            p.productID,
            p.productName,
            p.manufacturer,
            p.basePrice,
            p.company,
            p.createdAt,
            p.updatedAt
        );
    }

    /// Admin can list all products
    function getAllProducts()
        external
        view
        onlyAdmin
        returns (Product[] memory)
    {
        uint256 total = productList.length;
        Product[] memory list = new Product[](total);
        for (uint256 i = 0; i < total; i++) {
            list[i] = products[productList[i]];
        }
        return list;
    }
}
