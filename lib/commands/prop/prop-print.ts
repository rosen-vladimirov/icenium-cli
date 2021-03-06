import * as projectPropertyCommandBaseLib from "./prop-command-base";

export class PrintProjectCommand extends projectPropertyCommandBaseLib.ProjectPropertyCommandBase implements ICommand {
	constructor($staticConfig: IStaticConfig,
		$injector: IInjector,
		protected $options: IOptions) {
		super($staticConfig, $injector);
		if(!this.$options.validValue) {
			this.$project.ensureProject();
		}
	}

	execute(args:string[]): IFuture<void> {
		return ((): void => {
			let configs = this.$project.getConfigurationsSpecifiedByUser();
			if(configs.length) {
				_.each(configs, config => {
					this.$project.printProjectProperty(args[0], config).wait();
				});
			} else {
				this.$project.printProjectProperty(args[0]).wait();
			}
		}).future<void>()();
	}

	allowedParameters:ICommandParameter[] = [new PrintProjectCommandParameter(this.$project)];
}
$injector.registerCommand("prop|print", PrintProjectCommand);

class PrintProjectCommandParameter implements ICommandParameter {
	constructor(private $project: Project.IProject) { }

	mandatory = false;

	validate(validationValue: string): IFuture<boolean> {
		return ((): boolean => {
			return !!validationValue;
		}).future<boolean>()();
	}
}
