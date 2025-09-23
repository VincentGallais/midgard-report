DROP DATABASE IF EXISTS "midgard-bidinfo";

CREATE DATABASE "midgard-bidinfo";

\c "midgard-bidinfo"

CREATE TYPE generator_status AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'ERROR');
CREATE TYPE report_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE report (
    id SERIAL PRIMARY KEY,
    dealer VARCHAR(1) NOT NULL,
    vulnerability VARCHAR(1) NOT NULL,
    distribution VARCHAR(52) NOT NULL,
    bids VARCHAR NOT NULL,
    problematic_bid_idx INT,
    conventions_bids VARCHAR(50) NOT NULL,
    conventions_profile_bids INTEGER NOT NULL,
    parameter VARCHAR NOT NULL,
    expected_min INTEGER NOT NULL,
    expected_max INTEGER NOT NULL,
    actual_value INTEGER NOT NULL,
    gap INTEGER NOT NULL,
    status report_status DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE request (
    id SERIAL PRIMARY KEY,
    deal_nb INTEGER NOT NULL,
    conventions_bids VARCHAR(50) NOT NULL,
    conventions_profile_bids INTEGER NOT NULL,
    suit_tolerance INTEGER DEFAULT 0,
    hcp_tolerance INTEGER DEFAULT 0,
    bid_index_min INTEGER DEFAULT -1,
    bid_index_max INTEGER DEFAULT -1,
    status generator_status DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO request (deal_nb, conventions_bids, conventions_profile_bids) VALUES
    (1, '02010000011000101111011111111111111001112111111011', 6);

INSERT INTO report (dealer, vulnerability, distribution, bids, problematic_bid_idx, conventions_bids, conventions_profile_bids, parameter, expected_min, expected_max, actual_value, gap, status) VALUES
    ('N', 'N', 'EEESWSSSWNNNEENEEWNSSNNENNEWESNSWESENWSSWWWSNWWWESNW', '2N', 0, '02010000011000101111011111111111111001112111111011', 6, 'hcp', 20, 21, 19, 1, 'APPROVED'),
    ('N', 'N', 'EEESWSSSWNNNEENEEWNSSNNENNEWESNSWESENWSSWWWSNWWWESNW', '2N', 0, '02010000011000101111011111111111111001112111111011', 6, 'hcp', 20, 21, 19, 1, 'PENDING');
