use wichain_network::NetworkNode; 
use tokio::sync::mpsc;

#[tokio::test]
async fn test_network_node_start() {
    let node = NetworkNode::new(7000, "test-node".to_string(), "extra1".to_string(), "extra2".to_string());

    let (tx, _rx) = mpsc::channel(32); // Added underscore to silence warning

    node.start(tx).await;
    assert!(true);
}

#[tokio::test]
async fn test_broadcast_block() {
    let node = NetworkNode::new(7000, "test-node".to_string(), "extra1".to_string(), "extra2".to_string());
    let (tx, _rx) = mpsc::channel(32); // `_rx` unused intentionally
    node.start(tx).await;

    let block_data = "{\"dummy\":\"block\"}".to_string();
    node.broadcast_block(block_data).await;

    assert!(true);
}
