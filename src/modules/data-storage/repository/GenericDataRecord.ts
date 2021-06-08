import { uuid } from '../../../utils/uuid'
import { BaseRecord, Tags } from '../../../storage/BaseRecord'

interface KeyFormats {
    key: string
    mimeType: string
}

interface GenericDataProps {
    value: any
    mimeType: string
    key: string //Any keys inside of list
    tags?: Tags
}

const list = [
    {
        key: 'userProfile',
        mimeType: 'base64'
    }
]

export class GenericDataRecord extends BaseRecord implements GenericDataProps {
    public static readonly type = 'GenericDataRecord'
    public readonly type = GenericDataRecord.type
    
    public value!: any
    public mimeType!: string
    public key!: string

    public constructor(props: GenericDataProps) {
        super()
        
        if(props){
            this.id = props.key
            this.value = props.value
            this.mimeType = props.mimeType
            this.tags = props.tags ?? {}
        }
    }
}