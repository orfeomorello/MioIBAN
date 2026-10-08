package it.mioiban.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import it.mioiban.app.MioIbanApp
import it.mioiban.app.ui.screens.AccountDetailScreen
import it.mioiban.app.ui.screens.AccountFormScreen
import it.mioiban.app.ui.screens.AccountListScreen
import it.mioiban.app.ui.screens.OnboardingScreen
import it.mioiban.app.ui.screens.SettingsScreen
import it.mioiban.app.ui.screens.SportelloScreen

/** Rotte dell'app. Gli argomenti sono l'id del conto dove serve. */
object Routes {
    const val ONBOARDING = "onboarding"
    const val LIST = "list"
    const val SETTINGS = "settings"
    const val NEW = "form"
    const val EDIT = "form/{id}"
    const val DETAIL = "detail/{id}"
    const val SPORTELLO = "sportello/{id}"

    fun edit(id: String) = "form/$id"
    fun detail(id: String) = "detail/$id"
    fun sportello(id: String) = "sportello/$id"
}

@Composable
fun MioNavHost() {
    val app = LocalContext.current.applicationContext as MioIbanApp
    val nav = rememberNavController()
    val vm: MainViewModel = viewModel()

    val start = if (app.prefs.onboardingCompleted) Routes.LIST else Routes.ONBOARDING

    NavHost(navController = nav, startDestination = start) {
        composable(Routes.ONBOARDING) {
            OnboardingScreen(
                onFinished = {
                    nav.navigate(Routes.LIST) { popUpTo(Routes.ONBOARDING) { inclusive = true } }
                },
            )
        }
        composable(Routes.LIST) {
            AccountListScreen(
                vm = vm,
                onOpen = { nav.navigate(Routes.detail(it)) },
                onAdd = { nav.navigate(Routes.NEW) },
                onSettings = { nav.navigate(Routes.SETTINGS) },
            )
        }
        composable(Routes.NEW) {
            AccountFormScreen(
                vm = vm,
                editingId = null,
                onDone = { id ->
                    nav.popBackStack()
                    if (id != null) nav.navigate(Routes.detail(id))
                },
                onBack = { nav.popBackStack() },
            )
        }
        composable(
            route = Routes.EDIT,
            arguments = listOf(navArgument("id") { type = NavType.StringType }),
        ) { entry ->
            AccountFormScreen(
                vm = vm,
                editingId = entry.arguments?.getString("id"),
                onDone = { nav.popBackStack() },
                onBack = { nav.popBackStack() },
            )
        }
        composable(
            route = Routes.DETAIL,
            arguments = listOf(navArgument("id") { type = NavType.StringType }),
        ) { entry ->
            val id = entry.arguments?.getString("id") ?: return@composable
            AccountDetailScreen(
                vm = vm,
                accountId = id,
                onBack = { nav.popBackStack() },
                onEdit = { nav.navigate(Routes.edit(it)) },
                onSportello = { nav.navigate(Routes.sportello(it)) },
                onDeleted = { nav.popBackStack() },
            )
        }
        composable(
            route = Routes.SPORTELLO,
            arguments = listOf(navArgument("id") { type = NavType.StringType }),
        ) { entry ->
            val id = entry.arguments?.getString("id") ?: return@composable
            SportelloScreen(vm = vm, accountId = id, onBack = { nav.popBackStack() })
        }
        composable(Routes.SETTINGS) {
            SettingsScreen(vm = vm, onBack = { nav.popBackStack() })
        }
    }
}
