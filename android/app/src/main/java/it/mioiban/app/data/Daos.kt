package it.mioiban.app.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import kotlinx.coroutines.flow.Flow

@Dao
interface AccountDao {
    @Query("SELECT * FROM accounts")
    fun observeAll(): Flow<List<Account>>

    @Query("SELECT * FROM accounts")
    suspend fun getAll(): List<Account>

    @Query("SELECT * FROM accounts WHERE id = :id")
    suspend fun getById(id: String): Account?

    @Query("SELECT * FROM accounts WHERE iban = :iban LIMIT 1")
    suspend fun findByIban(iban: String): Account?

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insert(account: Account)

    @Query("UPDATE accounts SET lastUsedAt = :time WHERE id = :id")
    suspend fun touch(id: String, time: Long)

    @Query("DELETE FROM accounts WHERE id = :id")
    suspend fun delete(id: String)



    @Query("DELETE FROM accounts")
    suspend fun deleteAll()

    @Transaction
    suspend fun replaceAll(accounts: List<Account>) {
        deleteAll()
        accounts.forEach { insert(it) }
    }
}


