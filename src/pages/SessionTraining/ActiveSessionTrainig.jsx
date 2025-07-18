import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useForm } from "../../hooks/useForm";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import {
	fetchExerciseByTrainingAndSession,
	fetchTrainingSessionById,
	finishTrainingSession,
} from "../../api/trainingSessionApi";
import { fetchAllExercises } from "../../api/exerciseApi";
import { useLocation } from "react-router-dom";
import { useLoading } from "../../hooks/useLoading";

import Form from "../../components/Form";
import LoadingScreen from "../../components/LoadingScreen";
import Container from "../../components/Container";
import Header from "../../components/Header";
import Sidebar from "../../components/SideBar";
import Layout from "../../components/Layout";
import Footer from "../../components/Footer";

const ActiveTrainingSession = () => {
	const { id } = useParams();
	const navigate = useNavigate();
	const { user } = useAuth();
	const addToast = useToast();
	const location = useLocation();
	const { isLoading, setIsLoading } = useLoading();

	const trainingTitle = location.state?.trainingTitle || "Treino em andamento";
	const token = user?.token;

	const [isSidebarOpen, setIsSidebarOpen] = useState(false);
	const [session, setSession] = useState(null);
	const [exerciseOptions, setExerciseOptions] = useState([]);
	const [elapsedTime, setElapsedTime] = useState(0);
	const [btnDisabled, setBtnDisabled] = useState(false);

	const { values, handleChange, handleSubmit, resetForm } = useForm(
		{ exercise: [] },
		async (formData) => {
			try {
				if (!formData.exercise || formData.exercise.length === 0) {
					addToast("Adicione ao menos um exercício", "error");
					return;
				}

				setBtnDisabled(true);
				setIsLoading(true);

				const payload = formData.exercise.map((ex) => {
					const original = exerciseOptions.find(
						(o) => o.id_exercise === ex.id_exercise
					);

					const entry = { id_exercise: ex.id_exercise };

					if (!original || ex.series !== original.series) {
						entry.series = ex.series;
					}

					if (!original || ex.repetitions !== original.repetitions) {
						entry.repetitions = ex.repetitions;
					}

					if (!original || (ex.weight ?? "") !== (original.weight ?? "")) {
						const parsedWeight = Number(ex.weight);
						entry.weight = isNaN(parsedWeight) ? null : parsedWeight;
					}

					if (!original || (ex.notes ?? "") !== (original.notes ?? "")) {
						entry.notes = ex.notes ?? null;
					}

					return entry;
				});

				const data = await finishTrainingSession(
					token,
					session.id_training_session,
					payload
				);

				addToast(data.message, "success");
				navigate("/session/training");
			} catch (error) {
				addToast(error.message || "Erro ao finalizar treino", "error");
			} finally {
				setBtnDisabled(false);
				setIsLoading(false);
			}
		}
	);

	// Carregamento unificado da sessão + exercícios
	useEffect(() => {
		const loadAll = async () => {
			setIsLoading(true);

			try {
				const sessionData = await fetchTrainingSessionById(token, id);

				// Verificação de usuário
				if (sessionData.id_user !== user.id) {
					addToast("Acesso não autorizado à sessão", "error");
					navigate("/session/training");
					return;
				}

				// Verificação de sessão finalizada
				if (sessionData.finished_at) {
					addToast("Sessão já finalizada", "info");
					navigate("/session/training");
					return;
				}

				setSession(sessionData);

				const exerciseSessionData = await fetchExerciseByTrainingAndSession(
					token,
					id
				);
				const allExercises = await fetchAllExercises(token, 1, 0);

				const options = exerciseSessionData.map((exSession) => {
					const exercise = allExercises.data.find(
						(e) => e.id === exSession.id_exercise
					);
					return {
						value: exercise?.id,
						label: exercise?.name,
						id_exercise: exSession.id_exercise,
						series: exSession.series,
						repetitions: exSession.repetitions,
						weight: exSession.weight ?? "",
						notes: exSession.notes ?? "",
					};
				});

				setExerciseOptions(options);
				resetForm({ exercise: options });
			} catch (error) {
				addToast(error.message || "Erro ao carregar dados da sessão", "error");
				navigate("/session/training");
			} finally {
				setIsLoading(false);
			}
		};

		if (token && id) loadAll();
	}, [token, id]);

	// Cronômetro
	useEffect(() => {
		if (!session?.started_at) return;

		const start = new Date(session.started_at);
		const interval = setInterval(() => {
			const now = new Date();
			setElapsedTime(Math.floor((now - start) / 1000));
		}, 1000);

		return () => clearInterval(interval);
	}, [session]);

	const formatTime = (s) => {
		const h = Math.floor(s / 3600)
			.toString()
			.padStart(2, "0");
		const m = Math.floor((s % 3600) / 60)
			.toString()
			.padStart(2, "0");
		const sec = (s % 60).toString().padStart(2, "0");
		return `${h}h:${m}m:${sec}s`;
	};

	return (
		<>
			{isLoading && <LoadingScreen />}

			<Container>
				<Header />
				<Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
				<Layout
					isSidebarOpen={isSidebarOpen}
					title={"Treino: " + trainingTitle}>
					<section className="space-y-2 mt-7 mb-5 flex flex-row justify-between items-center">
						<div>
							<p className="text-black dark:text-white">
								Tempo decorrido: <strong>{formatTime(elapsedTime)}</strong>
							</p>
						</div>
					</section>

					<Form
						title="Finalizar treino"
						btnTitle="Finalizar"
						btnType="primary"
						btnDisabled={btnDisabled}
						fields={[{ name: "exercise" }]}
						values={values}
						handleChange={handleChange}
						handleSubmit={handleSubmit}
						exerciseOptions={exerciseOptions}
						showNotesAndWeight={true}
						changeClass="bg-white dark:bg-gray-900 shadow-md rounded-xl p-8 w-full max-w-2xl mx-auto mb-4 mt-4 transition-colors duration-300"
					/>
				</Layout>
				<Footer />
			</Container>
		</>
	);
};

export default ActiveTrainingSession;
