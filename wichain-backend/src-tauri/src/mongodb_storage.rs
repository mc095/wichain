//! MongoDB storage for WiChain messages
//! 
//! This module handles storing and retrieving chat messages from MongoDB
//! instead of plain JSON files.

use anyhow::Result;
use futures::TryStreamExt;
use mongodb::{
    bson::{doc, Document, oid::ObjectId},
    Client, Collection, Database,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;

/// MongoDB connection manager
#[derive(Debug, Clone)]
pub struct MongoStorage {
    client: Client,
    database: Database,
    messages_collection: Collection<ChatMessage>,
}

/// Chat message structure for MongoDB storage
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    #[serde(rename = "_id")]
    pub id: Option<ObjectId>,
    pub from: String,
    pub to: String,
    pub message: String,
    pub timestamp: u64,
    pub signature: String,
    pub encrypted: bool,
}

impl MongoStorage {
    /// Create a new MongoDB storage instance
    pub async fn new(connection_string: &str, database_name: &str) -> Result<Self> {
        let client = Client::with_uri_str(connection_string).await?;
        let database = client.database(database_name);
        let messages_collection = database.collection::<ChatMessage>("messages");
        
        // Create indexes for better performance
        let index_model = mongodb::IndexModel::builder()
            .keys(doc! { "from": 1, "to": 1 })
            .build();
        messages_collection.create_index(index_model, None).await?;
        
        let timestamp_index = mongodb::IndexModel::builder()
            .keys(doc! { "timestamp": 1 })
            .build();
        messages_collection.create_index(timestamp_index, None).await?;
        
        Ok(Self {
            client,
            database,
            messages_collection,
        })
    }
    
    /// Save a chat message to MongoDB
    pub async fn save_message(&self, message: ChatMessage) -> Result<()> {
        self.messages_collection.insert_one(message, None).await?;
        Ok(())
    }
    
    /// Get chat history between two peers
    pub async fn get_chat_history(&self, from: &str, to: &str, limit: Option<i64>) -> Result<Vec<ChatMessage>> {
        let filter = doc! {
            "$or": [
                { "from": from, "to": to },
                { "from": to, "to": from }
            ]
        };
        
        let mut options = mongodb::options::FindOptions::default();
        options.sort = Some(doc! { "timestamp": 1 });
        if let Some(limit) = limit {
            options.limit = Some(limit);
        }
        
        let cursor = self.messages_collection.find(filter, options).await?;
        let messages: Result<Vec<_>> = cursor.try_collect().await.map_err(|e| e.into());
        Ok(messages?)
    }
    
    /// Get all messages for a user (sent or received)
    pub async fn get_all_messages_for_user(&self, user_id: &str, limit: Option<i64>) -> Result<Vec<ChatMessage>> {
        let filter = doc! {
            "$or": [
                { "from": user_id },
                { "to": user_id }
            ]
        };
        
        let mut options = mongodb::options::FindOptions::default();
        options.sort = Some(doc! { "timestamp": 1 });
        if let Some(limit) = limit {
            options.limit = Some(limit);
        }
        
        let cursor = self.messages_collection.find(filter, options).await?;
        let messages: Result<Vec<_>> = cursor.try_collect().await.map_err(|e| e.into());
        Ok(messages?)
    }
    
    /// Clear all messages from the database
    pub async fn clear_all_messages(&self) -> Result<()> {
        self.messages_collection.delete_many(doc! {}, None).await?;
        Ok(())
    }
    
    /// Clear messages for a specific peer
    pub async fn clear_peer_messages(&self, peer_id: &str) -> Result<()> {
        let filter = doc! {
            "$or": [
                { "from": peer_id },
                { "to": peer_id }
            ]
        };
        self.messages_collection.delete_many(filter, None).await?;
        Ok(())
    }
    
    /// Get message count
    pub async fn get_message_count(&self) -> Result<u64> {
        let count = self.messages_collection.count_documents(doc! {}, None).await?;
        Ok(count)
    }
    
    /// Get database statistics
    pub async fn get_stats(&self) -> Result<Document> {
        let stats = self.database.run_command(doc! { "dbStats": 1 }, None).await?;
        Ok(stats)
    }
}

/// Global MongoDB storage instance
pub type MongoStorageArc = Arc<Mutex<Option<MongoStorage>>>;

/// Initialize MongoDB storage
pub async fn init_mongodb_storage() -> Result<MongoStorageArc> {
    // Default connection string for local MongoDB
    let connection_string = "mongodb://localhost:27017";
    let database_name = "wichain_messages";
    
    match MongoStorage::new(connection_string, database_name).await {
        Ok(storage) => {
            log::info!("✅ MongoDB storage initialized successfully");
            Ok(Arc::new(Mutex::new(Some(storage))))
        }
        Err(e) => {
            log::warn!("⚠️  Failed to connect to MongoDB: {}. Messages will not be persisted.", e);
            Ok(Arc::new(Mutex::new(None)))
        }
    }
}

/// Helper function to convert blockchain message to MongoDB message
pub fn blockchain_to_mongo_message(
    from: String,
    to: String,
    message: String,
    timestamp: u64,
    signature: String,
    encrypted: bool,
) -> ChatMessage {
    ChatMessage {
        id: None, // MongoDB will generate this
        from,
        to,
        message,
        timestamp,
        signature,
        encrypted,
    }
}
